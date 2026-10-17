import "server-only";
import { fetchTransfers, redactKey, type Prices } from "./alchemy";
import type { LabelCategory } from "./categories";
import { aggregate, blockOf, bundleKey, pricesOrFallback, ZERO_ADDRESS, type Flow } from "./flows";
import type { Side } from "./graph";
import { getTag } from "./labels";
import { lookThrough, type LookThroughCandidate, type LookThroughStats } from "./lookthrough";
import { counted, scoreRisk, type RiskFlow, type RiskInput, type RiskResult } from "./risk";
import { DUST_ETH } from "./risk-config";

// 위험 점수용 데이터 모으기: 시작 주소의 받은·보낸 상대 + 라벨 없는 큰 상대는 한 단계 더 (PLAN 5장)
// 계산 자체는 lib/risk.ts의 순수 함수

export type RiskReport = RiskResult &
  LookThroughStats & {
    truncated: Record<Side, boolean>; // 시작 주소 기록이 1,000건 넘어서 최근 1,000건만 봄
    approx: boolean; // 토큰 시세를 못 가져와서 근사값으로 환산
  };

const SIDES: Side[] = ["in", "out"];

function sum(list: LookThroughStats[], key: keyof LookThroughStats) {
  return list.reduce((total, stats) => total + stats[key], 0);
}

// 라벨 없는 상대 X를 한 단계 더: 받은 쪽은 X가 받은 돈(출처), 보낸 쪽은 X가 보낸 돈(사용처)
async function lookInto(
  center: string,
  flow: Flow,
  side: Side,
  prices: Prices,
): Promise<NonNullable<RiskFlow["next"]> | null> {
  const page = await fetchTransfers(flow.counterparty, side);
  // 거래가 1,000건 넘는 주소는 거래소·서비스일 수 있어서 들여다보지 않음 (그래프 브레이크 ④와 같은 기준)
  if (page.hasMore) return null;
  // 시간 순서: 받은 쪽은 X가 시작 주소에 마지막으로 보내기 전까지 X가 받은 돈,
  // 보낸 쪽은 시작 주소에게 처음 받은 뒤 X가 보낸 돈만 (그 전후 돈은 시작 주소와 상관없음)
  const transfers = page.transfers.filter((transfer) =>
    side === "in" ? blockOf(transfer) <= flow.lastBlock : blockOf(transfer) >= flow.firstBlock,
  );
  // 시작 주소와 되돌려 주고받은 돈은 빼고, 받은 먼지는 무시 (점수와 같은 규칙)
  const flows = aggregate(flow.counterparty, side, transfers, prices).filter(
    (f) => f.counterparty !== center && (side === "out" || f.valueEth >= DUST_ETH),
  );
  const byCategory: Partial<Record<LabelCategory, number>> = {};
  for (const f of flows) {
    const category = getTag(f.counterparty)?.category;
    if (category) byCategory[category] = (byCategory[category] ?? 0) + f.valueEth;
  }
  return { totalEth: flows.reduce((total, f) => total + f.valueEth, 0), byCategory };
}

export async function analyzeRisk(center: string): Promise<{ report: RiskReport; input: RiskInput }> {
  const { prices, approx } = await pricesOrFallback();
  const pages = await Promise.all(SIDES.map((side) => fetchTransfers(center, side)));
  const tag = getTag(center);
  const victim = tag?.category === "victim";

  const flows: RiskFlow[] = [];
  const sourceOf = new Map<RiskFlow, Flow>();
  const plans = SIDES.map((side, i) => {
    const candidates: LookThroughCandidate[] = [];
    for (const flow of aggregate(center, side, pages[i].transfers, prices)) {
      const tagOf = getTag(flow.counterparty);
      const risk: RiskFlow = {
        side,
        address: flow.counterparty,
        valueEth: flow.valueEth,
        category: tagOf?.category ?? null,
      };
      // 받은 먼지·피해 지갑이 해커에게 보낸 돈은 점수에서 빠짐 → 2단계 후보 기준 합계에서도 뺌
      if (!counted(risk, victim)) continue;
      flows.push(risk);
      sourceOf.set(risk, flow);
      if (!tagOf && flow.counterparty !== ZERO_ADDRESS) candidates.push({ flow: risk, key: bundleKey(flow) });
    }
    const totalEth = flows.filter((f) => f.side === side).reduce((total, f) => total + f.valueEth, 0);
    return { side, candidates, totalEth };
  });

  // 금액 큰 몇 곳(비슷한 금액 묶음은 1곳으로)만 한 단계 더. 빠진 비율은 화면에 '확인한 돈'으로 보여줌
  const looked = await Promise.all(
    plans.map(({ side, candidates, totalEth }) =>
      lookThrough(candidates, totalEth, (risk) => {
        const flow = sourceOf.get(risk);
        if (!flow) return Promise.resolve(null);
        // 실패는 lookThrough가 세고, 오류 내용은 여기서 (키를 가린 채) 남김
        return lookInto(center, flow, side, prices).catch((error) => {
          console.error(`[risk] look-through failed: ${redactKey(String(error))}`);
          throw error;
        });
      }),
    ),
  );

  const input: RiskInput = {
    center: tag ? { category: tag.category, source: tag.source, community: tag.community } : null,
    flows,
  };
  return {
    input,
    report: {
      ...scoreRisk(input),
      truncated: { in: pages[0].hasMore, out: pages[1].hasMore },
      approx,
      failed: sum(looked, "failed"),
      estimated: sum(looked, "estimated"),
      grouped: sum(looked, "grouped"),
      sampled: sum(looked, "sampled"),
    },
  };
}
