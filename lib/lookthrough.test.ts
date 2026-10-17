// 2단계 들여다보기 계획 단위 테스트 (PLAN 5장 '묶어서 계산하기'). 실행: npm test
import { describe, expect, it } from "vitest";
import { lookThrough, type LookThroughCandidate } from "./lookthrough";
import { scoreRisk, type RiskFlow } from "./risk";
import { GRAPH, RISK } from "./risk-config";

// 시작 주소가 보낸 돈을 n개 지갑에 나눠 보냈고, 그 지갑들이 모두 믹서로 보낸 경우
function split(totalEth: number, wallets: number, otherEth = 0) {
  const flows: RiskFlow[] = Array.from({ length: wallets }, (_, i) => ({
    side: "out",
    address: `0xsplit${i}`,
    valueEth: totalEth / wallets,
    category: null,
  }));
  if (otherEth > 0) flows.push({ side: "out", address: "0xother", valueEth: otherEth, category: null });
  return flows;
}

type Lookup = (flow: RiskFlow) => Promise<NonNullable<RiskFlow["next"]> | null>;

const toMixer: Lookup = async (flow) =>
  flow.address === "0xother" ? null : { totalEth: flow.valueEth, byCategory: { mixer: flow.valueEth } };

async function scoreAfterLookThrough(flows: RiskFlow[], lookup: Lookup = toMixer) {
  const candidates: LookThroughCandidate[] = flows.map((flow) => ({
    flow,
    // 같은 금액 → 같은 묶음 키 (실제로는 lib/flows.ts bundleKey: 토큰 + 유효숫자 3자리)
    key: `ETH:${flow.valueEth.toPrecision(3)}`,
  }));
  const totalEth = flows.reduce((total, f) => total + f.valueEth, 0);
  const calls: string[] = [];
  const result = await lookThrough(candidates, totalEth, (flow) => {
    calls.push(flow.address);
    return lookup(flow);
  });
  return { ...result, calls, risk: scoreRisk({ center: null, flows }) };
}

describe("비슷한 금액 지갑으로 쪼개도 2단계 점수 그대로", () => {
  it("800 ETH 지갑 1곳 = 100 ETH × 8곳 = 4 ETH × 200곳 (모두 믹서로 감)", async () => {
    const one = await scoreAfterLookThrough(split(800, 1, 800));
    const eight = await scoreAfterLookThrough(split(800, 8, 800));
    const many = await scoreAfterLookThrough(split(800, 200, 800));
    // 0.7(믹서) × 0.5(2단계) × 0.5(보낸 돈의 절반) = 17.5 → 18점
    expect(one.risk.sides.out.score).toBe(18);
    expect(eight.risk.sides.out.score).toBe(one.risk.sides.out.score);
    expect(many.risk.sides.out.score).toBe(one.risk.sides.out.score);
  });

  it("묶음은 금액 큰 몇 곳만 실제로 조회 (호출 수 제한), 나머지는 '같다고 봄'", async () => {
    const many = await scoreAfterLookThrough(split(800, 200));
    expect(many.calls).toHaveLength(RISK.lookThroughSamples);
    expect(many).toMatchObject({
      estimated: 200 - RISK.lookThroughSamples,
      grouped: 200,
      sampled: RISK.lookThroughSamples,
      failed: 0,
    });
    expect(many.risk.sides.out.coverage).toBe(1);
  });

  it("같은 금액이 GRAPH.bundleMin곳보다 적으면 묶지 않고 하나씩 봄 (흔한 금액이 우연히 겹친 경우)", async () => {
    expect(GRAPH.bundleMin).toBeGreaterThan(3);
    const flows = split(150, 3);
    // 세 번째 지갑만 믹서로 감
    const result = await scoreAfterLookThrough(flows, async (flow) =>
      flow.address === "0xsplit2"
        ? { totalEth: 50, byCategory: { mixer: 50 } }
        : { totalEth: 50, byCategory: { exchange: 50 } },
    );
    expect(result.calls).toHaveLength(3);
    expect(result.estimated).toBe(0);
    // 0.7 × 0.5 × (1/3) = 0.1167 → 12점
    expect(result.risk.sides.out.score).toBe(12);
  });
});

describe("들여다볼 곳 고르기", () => {
  it("금액 큰 순으로 최대 RISK.lookThroughPerSide곳, 1% 미만은 안 봄", async () => {
    const flows: RiskFlow[] = [100, 90, 80, 70, 60, 0.5].map((valueEth, i) => ({
      side: "in",
      address: `0x${i}`,
      valueEth,
      category: null,
    }));
    const candidates = flows.map((flow) => ({ flow, key: null }));
    const calls: string[] = [];
    await lookThrough(candidates, 400.5, async (flow) => {
      calls.push(flow.address);
      return { totalEth: 1, byCategory: {} };
    });
    expect(calls).toEqual(["0x0", "0x1", "0x2", "0x3"].slice(0, RISK.lookThroughPerSide));
  });

  it("조회 실패는 세고 나머지로 계속, 거래가 너무 많은 주소(null)는 확인 범위에서 빠짐", async () => {
    const flows: RiskFlow[] = [
      { side: "in", address: "0xfail", valueEth: 50, category: null },
      { side: "in", address: "0xhub", valueEth: 30, category: null },
      { side: "in", address: "0xok", valueEth: 20, category: null },
    ];
    const result = await lookThrough(
      flows.map((flow) => ({ flow, key: null })),
      100,
      async (flow) => {
        if (flow.address === "0xfail") throw new Error("upstream");
        if (flow.address === "0xhub") return null;
        return { totalEth: 10, byCategory: { hacker: 10 } };
      },
    );
    expect(result.failed).toBe(1);
    const risk = scoreRisk({ center: null, flows });
    expect(risk.sides.in.coverage).toBeCloseTo(0.2);
    // 0.9 × 0.5 × 0.2 = 0.09 → 9점
    expect(risk.sides.in.score).toBe(9);
  });

  it("묶음에서 본 곳이 서비스(null)면 그 곳은 빼고, 본 곳 비율만 나머지에 씀", async () => {
    const flows = split(50, 5);
    const result = await lookThrough(
      flows.map((flow) => ({ flow, key: "ETH:10.0" })),
      50,
      async (flow) => (flow.address === "0xsplit0" ? null : { totalEth: 10, byCategory: { mixer: 5 } }),
    );
    expect(result).toMatchObject({ estimated: 3, grouped: 5, sampled: 1, failed: 0 });
    expect(flows[0].next).toBeUndefined();
    expect(flows[4].next).toMatchObject({ estimated: true, totalEth: 10, byCategory: { mixer: 5 } });
  });

  it("묶음의 표본 조회가 다 실패하면 묶음 전체를 '못 따라감'으로 셈", async () => {
    const flows = split(400, 40);
    const result = await lookThrough(
      flows.map((flow) => ({ flow, key: "ETH:10.0" })),
      400,
      async () => {
        throw new Error("rate-limited");
      },
    );
    expect(result).toMatchObject({ failed: 40, estimated: 0 });
    expect(scoreRisk({ center: null, flows }).sides.out.coverage).toBe(0);
  });

  it("표본 하나만 실패하면 실패한 곳도 다른 표본 비율로 봄 (실패로 세지 않음)", async () => {
    const flows = split(400, 40);
    const result = await lookThrough(
      flows.map((flow) => ({ flow, key: "ETH:10.0" })),
      400,
      async (flow) => {
        if (flow.address === "0xsplit0") throw new Error("timeout");
        return { totalEth: 10, byCategory: { mixer: 10 } };
      },
    );
    expect(result).toMatchObject({ failed: 0, estimated: 39, grouped: 40, sampled: 1 });
    expect(flows[0].next).toMatchObject({ estimated: true });
    // 보낸 돈 전부가 2단계 믹서 → 0.7 × 0.5 = 35점
    expect(scoreRisk({ center: null, flows }).sides.out.score).toBe(35);
  });
});
