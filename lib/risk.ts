// 위험 점수 계산. 네트워크·서버 의존이 없는 순수 함수라 단위 테스트(lib/risk.test.ts)로 확인
// 데이터 모으기(Alchemy 호출, 2단계 들여다보기)는 lib/exposure.ts
import type { LabelCategory } from "./categories";
import type { Side } from "./graph";
import { DUST_ETH, RISK } from "./risk-config";

// 시작 주소와 상대 하나 사이에 한 방향으로 오간 돈
export type RiskFlow = {
  side: Side; // in = 받은 돈, out = 보낸 돈
  address: string; // 상대 주소 (소문자)
  valueEth: number;
  category: LabelCategory | null; // 상대 라벨
  // 라벨 없는 상대를 한 단계 더 들여다본 결과 (들여다본 경우만):
  // 받은 쪽이면 그 상대가 받은 돈(출처), 보낸 쪽이면 그 상대가 보낸 돈(사용처)의 카테고리별 금액
  // estimated = 비슷한 금액 묶음에서 다른 곳을 보고 같은 비율이라고 본 경우 (lib/lookthrough.ts)
  next?: { totalEth: number; byCategory: Partial<Record<LabelCategory, number>>; estimated?: boolean };
};

export type RiskCenter = { category: LabelCategory; source: string; community: boolean } | null;

export type RiskInput = { center: RiskCenter; flows: RiskFlow[] };

export type RiskGrade = (typeof RISK.grades)[number]["key"];

export type ExposureReason = {
  kind: "exposure";
  side: Side;
  hop: number; // 1 = 직접, 2 = 한 곳 거쳐서
  category: LabelCategory;
  share: number; // 그쪽 전체 금액 중 이 경로로 오간 비율 (0~1, 2단계는 단계마다 비율을 곱함)
  valueEth: number;
  points: number; // 이 이유 하나만 있을 때의 점수
  added: number; // 같은 쪽 앞 이유들에 더해진 점수 (같은 쪽 added를 다 더하면 그쪽 점수)
};

export type RiskReason =
  | {
      kind: "self"; // 주소 자체가 제재·해커 라벨 → 최소 점수
      category: LabelCategory;
      source: string;
      community: boolean;
      points: number;
    }
  | { kind: "sent-sanctioned"; valueEth: number; points: number } // 제재 주소로 직접 보냄 → 최소 점수
  | ExposureReason;

export type RiskSide = {
  score: number;
  totalEth: number; // 점수에 쓴 금액 합계 (받은 먼지·피해 지갑이 해커에게 보낸 돈 제외)
  coverage: number; // 그중 라벨이 있거나 한 단계 더 들여다본 상대와 오간 비율 (0~1)
};

export type RiskResult = {
  score: number; // 대표 점수 = max(받은 돈 점수, 보낸 돈 점수, 최소 점수)
  grade: RiskGrade;
  gradeName: string;
  sides: Record<Side, RiskSide>;
  reasons: RiskReason[]; // 최소 점수 이유 먼저, 그다음 기여도 큰 순
  victim: boolean; // 해킹 피해 지갑이라 해커에게 보낸 돈은 뺐음
};

const SIDES: Side[] = ["in", "out"];

export function gradeOf(score: number) {
  return RISK.grades.find((grade) => score >= grade.min) ?? RISK.grades[RISK.grades.length - 1];
}

function weight(category: LabelCategory) {
  return RISK.weights[category] ?? 0;
}

function discount(hop: number) {
  return RISK.hopDiscount[hop] ?? 0;
}

// 0~1 → 0~100점. 1 − (1 − 0.105)가 0.10499…로 나오는 소수 오차 때문에 반올림이 1점 틀리지 않게 먼저 정리
function toPoints(risk: number) {
  return Math.round(Number((100 * risk).toFixed(9)));
}

// 해킹 피해 지갑이 해커에게 보낸 돈(= 털린 돈)은 점수에서 뺌 (PLAN 5장 알려진 한계)
function excluded(victim: boolean, side: Side, category: LabelCategory | null) {
  return victim && side === "out" && category === "hacker";
}

// 점수에 넣는 흐름: 받은 먼지는 무시 (누구나 아무 주소에 소액을 보낼 수 있어서). 보낸 돈은 작아도 셈
// lib/exposure.ts도 2단계 후보를 고를 때 같은 기준으로 합계를 냄
export function counted(flow: RiskFlow, victim: boolean) {
  if (!(flow.valueEth > 0)) return false;
  if (flow.side === "in" && flow.valueEth < DUST_ETH) return false;
  return !excluded(victim, flow.side, flow.category);
}

export function scoreRisk({ center, flows }: RiskInput): RiskResult {
  const victim = center?.category === "victim";
  const exposures: { reason: ExposureReason; contribution: number }[] = [];
  const sides = {} as Record<Side, RiskSide>;

  for (const side of SIDES) {
    const list = flows.filter((flow) => flow.side === side && counted(flow, victim));
    const totalEth = list.reduce((total, flow) => total + flow.valueEth, 0);

    // (단계, 카테고리) 묶음마다 금액을 먼저 다 더함 → 같은 돈을 지갑 40개로 쪼개도 점수가 같음
    const groups = new Map<string, { hop: number; category: LabelCategory; valueEth: number }>();
    const add = (hop: number, category: LabelCategory, valueEth: number) => {
      const key = `${hop}:${category}`;
      const group = groups.get(key) ?? { hop, category, valueEth: 0 };
      group.valueEth += valueEth;
      groups.set(key, group);
    };

    let checkedEth = 0;
    for (const flow of list) {
      if (flow.category) {
        // 라벨이 있는 상대에서 멈춤 (그 너머는 보지 않음)
        checkedEth += flow.valueEth;
        add(1, flow.category, flow.valueEth);
        continue;
      }
      if (!flow.next) continue;
      checkedEth += flow.valueEth;
      if (!(flow.next.totalEth > 0)) continue;
      // 2단계: 상대 돈 중 카테고리 C의 비율만큼만 (단계마다 비율을 곱함 = Haircut)
      for (const [category, value] of Object.entries(flow.next.byCategory) as [LabelCategory, number][]) {
        if (!(value > 0) || excluded(victim, side, category)) continue;
        add(2, category, flow.valueEth * Math.min(1, value / flow.next.totalEth));
      }
    }

    const items = [...groups.values()]
      .map((group) => {
        const share = totalEth > 0 ? Math.min(1, group.valueEth / totalEth) : 0;
        return { ...group, share, contribution: weight(group.category) * discount(group.hop) * share };
      })
      .filter((item) => item.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution);

    // 합치기: 위험 = 1 − (1 − 기여도1) × (1 − 기여도2) × … → 아무리 많아도 100을 안 넘음
    let safe = 1;
    let score = 0;
    for (const item of items) {
      safe *= 1 - item.contribution;
      const next = toPoints(1 - safe);
      exposures.push({
        reason: {
          kind: "exposure",
          side,
          hop: item.hop,
          category: item.category,
          share: item.share,
          valueEth: item.valueEth,
          points: toPoints(item.contribution),
          added: next - score,
        },
        contribution: item.contribution,
      });
      score = next;
    }
    sides[side] = { score, totalEth, coverage: totalEth > 0 ? Math.min(1, checkedEth / totalEth) : 0 };
  }

  // 최소 점수: 주소 자체가 제재·해커 / 제재 주소로 직접 보냄 (금액 무관)
  const reasons: RiskReason[] = [];
  if (center && (center.category === "sanctioned" || center.category === "hacker")) {
    reasons.push({
      kind: "self",
      category: center.category,
      source: center.source,
      community: center.community,
      points: RISK.floor,
    });
  }
  const sentToSanctioned = flows
    .filter((flow) => flow.side === "out" && flow.category === "sanctioned" && flow.valueEth > 0)
    .reduce((total, flow) => total + flow.valueEth, 0);
  if (sentToSanctioned > 0) {
    reasons.push({ kind: "sent-sanctioned", valueEth: sentToSanctioned, points: RISK.floor });
  }
  const floor = reasons.length > 0 ? RISK.floor : 0;

  // 기여도 큰 순 (같은 쪽 안에서는 added를 계산한 순서 그대로 → '앞 이유들에 더해진 점수'가 맞게)
  exposures.sort((a, b) => b.contribution - a.contribution);
  reasons.push(...exposures.map(({ reason }) => reason));

  const score = Math.min(100, Math.max(sides.in.score, sides.out.score, floor));
  const grade = gradeOf(score);
  return { score, grade: grade.key, gradeName: grade.name, sides, reasons, victim };
}
