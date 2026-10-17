// 위험 점수 2단계: 라벨 없는 상대 몇 곳을 한 단계 더 들여다보는 계획 (lib/exposure.ts가 씀)
// 네트워크 호출은 lookup 함수로 받아서, 여기 규칙은 단위 테스트(lib/lookthrough.test.ts)로 확인
import type { RiskFlow } from "./risk";
import { GRAPH, RISK } from "./risk-config";

type Next = NonNullable<RiskFlow["next"]>;

// key = 비슷한 금액 묶음 키 (같은 토큰 1종 + 유효숫자 3자리, lib/flows.ts bundleKey). 없으면 null
export type LookThroughCandidate = { flow: RiskFlow; key: string | null };

export type LookThroughStats = {
  failed: number; // 조회에 실패해서 2단계가 빠진 상대 수 (묶음 전체가 빠지면 묶음 크기만큼)
  estimated: number; // 직접 안 보고 같은 묶음의 다른 곳 비율을 그대로 쓴 상대 수
  grouped: number; // 그렇게 같다고 본 묶음들의 전체 상대 수
  sampled: number; // 그 묶음들에서 실제로 따라가 본 상대 수
};

type Unit = { members: RiskFlow[]; valueEth: number };

// 비슷한 금액이 GRAPH.bundleMin곳 이상이면 한 덩어리 (그래프 꽃잎 묶음과 같은 기준). 나머지는 1곳씩
// (1 ETH·10 ETH 같은 흔한 금액이 2~4곳 겹친 건 서로 상관없는 사람일 수 있어서 따로 봄)
function toUnits(candidates: LookThroughCandidate[]): Unit[] {
  const byKey = new Map<string, RiskFlow[]>();
  for (const { flow, key } of candidates) {
    if (key) byKey.set(key, [...(byKey.get(key) ?? []), flow]);
  }
  const units: Unit[] = [];
  const grouped = new Set<RiskFlow>();
  for (const members of byKey.values()) {
    if (members.length < GRAPH.bundleMin) continue;
    units.push({ members, valueEth: members.reduce((total, f) => total + f.valueEth, 0) });
    members.forEach((f) => grouped.add(f));
  }
  for (const { flow } of candidates) {
    if (!grouped.has(flow)) units.push({ members: [flow], valueEth: flow.valueEth });
  }
  return units.sort((a, b) => b.valueEth - a.valueEth);
}

// 금액 큰 순으로 몇 덩어리만 (Alchemy 호출 수 제한). 묶음은 몇 곳만 보고 나머지도 같은 비율이라고 봄
// → 같은 돈을 비슷한 금액 지갑 여러 개로 쪼개도 점수가 같게 (PLAN 5장 '묶어서 계산하기')
// 결과는 각 flow.next에 채움
export async function lookThrough(
  candidates: LookThroughCandidate[],
  totalEth: number,
  lookup: (flow: RiskFlow) => Promise<Next | null>,
): Promise<LookThroughStats> {
  const units = toUnits(candidates)
    .filter((unit) => unit.valueEth > 0 && unit.valueEth >= totalEth * RISK.lookThroughMinShare)
    .slice(0, RISK.lookThroughPerSide);

  const stats: LookThroughStats = { failed: 0, estimated: 0, grouped: 0, sampled: 0 };
  await Promise.all(
    units.map(async (unit) => {
      const samples = [...unit.members]
        .sort((a, b) => b.valueEth - a.valueEth)
        .slice(0, RISK.lookThroughSamples);
      const results = await Promise.all(
        samples.map(async (flow) => {
          try {
            // null = 거래가 너무 많은 주소 (서비스일 수 있어서 들여다보지 않음 → 확인 범위에서 빠짐)
            return { flow, next: await lookup(flow), error: false };
          } catch {
            return { flow, next: null, error: true };
          }
        }),
      );
      const seen = results.filter((r): r is typeof r & { next: Next } => r.next !== null);
      seen.forEach(({ flow, next }) => (flow.next = next));
      if (seen.length === 0) {
        // 하나도 못 봄: 조회 실패가 있었으면 이 덩어리(서비스로 보고 건너뛴 곳 빼고) 전체가 2단계에서 빠짐
        if (results.some((r) => r.error)) {
          stats.failed += unit.members.length - results.filter((r) => !r.error).length;
        }
        return;
      }
      // 본 곳들의 합계 비율을 나머지(실패한 표본 포함)에 그대로 씀 (금액은 scoreRisk가 비율 × 그 상대 금액으로 계산)
      const rest = unit.members.filter(
        (flow) => !results.some((r) => r.flow === flow && !r.error),
      );
      if (rest.length === 0) return;
      const combined: Next = { totalEth: 0, byCategory: {}, estimated: true };
      for (const { next } of seen) {
        combined.totalEth += next.totalEth;
        for (const [category, value] of Object.entries(next.byCategory) as [keyof Next["byCategory"], number][]) {
          combined.byCategory[category] = (combined.byCategory[category] ?? 0) + value;
        }
      }
      rest.forEach((flow) => (flow.next = combined));
      stats.estimated += rest.length;
      stats.grouped += unit.members.length;
      stats.sampled += seen.length;
    }),
  );
  return stats;
}
