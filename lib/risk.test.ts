// 위험 점수 단위 테스트. 실행: npm test
import { describe, expect, it } from "vitest";
import bybit from "./__fixtures__/risk-bybit.json";
import ronin from "./__fixtures__/risk-ronin.json";
import upbit from "./__fixtures__/risk-upbit.json";
import { gradeOf, scoreRisk, type RiskFlow, type RiskInput } from "./risk";

type Fixture = { expected: { score: number; in: number; out: number }; input: RiskInput };

let n = 0;
// 테스트용 상대 주소 (진짜 주소 아님)
function flow(side: RiskFlow["side"], valueEth: number, category: RiskFlow["category"] = null, next?: RiskFlow["next"]): RiskFlow {
  n++;
  return { side, address: `0x${n.toString(16).padStart(40, "0")}`, valueEth, category, ...(next ? { next } : {}) };
}

function exposureOnly(input: RiskInput): RiskInput {
  return { ...input, center: null };
}

describe("PLAN 5장 예시", () => {
  // 총 10 ETH를 받음: 해커한테 직접 2 ETH, 친구 X한테 5 ETH(X 돈의 절반이 믹서), 나머지 3 ETH는 라벨 없음
  const result = scoreRisk({
    center: null,
    flows: [
      flow("in", 2, "hacker"),
      flow("in", 5, null, { totalEth: 10, byCategory: { mixer: 5 } }),
      flow("in", 3),
    ],
  });

  it("유입 점수 25점 (보통)", () => {
    expect(result.sides.in.score).toBe(25);
    expect(result.score).toBe(25);
    expect(result.gradeName).toBe("보통");
  });

  it("이유: ① 1단계 해커 18점 ② 2단계 믹서 약 9점 (합산 시 +7)", () => {
    const [first, second] = result.reasons;
    expect(first).toMatchObject({ kind: "exposure", hop: 1, category: "hacker", points: 18, added: 18 });
    expect(first.kind === "exposure" && first.share).toBeCloseTo(0.2);
    expect(second).toMatchObject({ kind: "exposure", hop: 2, category: "mixer", points: 9, added: 7 });
    expect(second.kind === "exposure" && second.share).toBeCloseTo(0.25);
  });
});

describe("묶어서 계산하기 (지갑을 쪼개도 점수 그대로)", () => {
  it("1만 ETH × 40개 지갑 = 40만 ETH 지갑 하나", () => {
    const split = scoreRisk({
      center: null,
      flows: [...Array.from({ length: 40 }, () => flow("out", 10_000, "hacker")), flow("out", 1_250)],
    });
    const merged = scoreRisk({ center: null, flows: [flow("out", 400_000, "hacker"), flow("out", 1_250)] });
    expect(split.score).toBe(merged.score);
    expect(split.reasons).toHaveLength(1); // 이유도 묶음 하나
  });

  it("2단계도 묶음마다: 믹서 돈이 섞인 지갑 2곳 = 합친 지갑 1곳", () => {
    const split = scoreRisk({
      center: null,
      flows: [
        flow("in", 3, null, { totalEth: 6, byCategory: { mixer: 3 } }),
        flow("in", 3, null, { totalEth: 6, byCategory: { mixer: 3 } }),
        flow("in", 4),
      ],
    });
    const merged = scoreRisk({
      center: null,
      flows: [flow("in", 6, null, { totalEth: 12, byCategory: { mixer: 6 } }), flow("in", 4)],
    });
    expect(split.sides.in.score).toBe(merged.sides.in.score);
  });

  it("Bybit 실제 자료: 해커 지갑들을 하나로 합치거나 하나를 40개로 쪼개도 점수 그대로", () => {
    const { input } = bybit as Fixture;
    const base = scoreRisk(exposureOnly(input));
    const hackerOut = input.flows.filter((f) => f.side === "out" && f.category === "hacker");
    const others = input.flows.filter((f) => !hackerOut.includes(f));
    const total = hackerOut.reduce((sum, f) => sum + f.valueEth, 0);
    const merged = scoreRisk({ center: null, flows: [...others, { ...hackerOut[0], valueEth: total }] });
    const [first, ...rest] = hackerOut;
    const split = scoreRisk({
      center: null,
      flows: [
        ...others,
        ...rest,
        ...Array.from({ length: 40 }, (_, i) => ({ ...first, address: `${first.address}-${i}`, valueEth: first.valueEth / 40 })),
      ],
    });
    expect(merged.score).toBe(base.score);
    expect(split.score).toBe(base.score);
  });
});

describe("데모 3개 (2026-10-17 실제 자료)", () => {
  it("Bybit 해커 80점 이상 — 주소 자체 라벨 없이 보낸 돈만으로도 (해커 지갑으로 약 99.7%)", () => {
    const { input, expected } = bybit as Fixture;
    expect(scoreRisk(input).score).toBe(expected.score);
    expect(scoreRisk(input).score).toBeGreaterThanOrEqual(80);
    const exposure = scoreRisk(exposureOnly(input));
    expect(exposure.sides.out.score).toBeGreaterThanOrEqual(80);
  });

  it("받은 돈·보낸 돈 점수도 자료를 받은 날 계산과 같음 (최소 점수 90에 가려지지 않게)", () => {
    for (const { input, expected } of [bybit, ronin, upbit] as Fixture[]) {
      const result = scoreRisk(input);
      expect(result.sides.in.score).toBe(expected.in);
      expect(result.sides.out.score).toBe(expected.out);
    }
  });

  it("Ronin 90점 이상 (주소 자체가 OFAC 제재 대상) + 제재 주소로 직접 보냄", () => {
    const { input, expected } = ronin as Fixture;
    const result = scoreRisk(input);
    expect(result.score).toBe(expected.score);
    // 최소 점수 없이 보낸 돈만으로도 높음 이상 (제재 주소로 75%, 해커 지갑으로 25%)
    expect(scoreRisk(exposureOnly(input)).sides.out.score).toBeGreaterThanOrEqual(80);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.reasons[0]).toMatchObject({ kind: "self", category: "sanctioned", points: 90 });
    expect(result.reasons.some((r) => r.kind === "sent-sanctioned")).toBe(true);
  });

  it("업비트 2019 80점 이상", () => {
    const { input, expected } = upbit as Fixture;
    const result = scoreRisk(input);
    expect(result.score).toBe(expected.score);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(scoreRisk(exposureOnly(input)).score).toBeGreaterThanOrEqual(80);
  });
});

describe("정상 지갑", () => {
  it("거래소에서 받고 DEX·지인에게 보낸 지갑 + 해커가 보낸 먼지 → 20점 미만", () => {
    const result = scoreRisk({
      center: null,
      flows: [
        flow("in", 12, "exchange"),
        flow("in", 0.5),
        flow("in", 0.005, "hacker"), // 받은 먼지: 무시
        flow("in", 0.001, "sanctioned"), // 받은 먼지: 무시 (최소 점수도 아님)
        flow("out", 6, "dex"),
        flow("out", 3),
        flow("out", 2, null, { totalEth: 2, byCategory: { exchange: 2 } }),
      ],
    });
    expect(result.score).toBeLessThan(20);
    expect(result.score).toBe(0);
    expect(result.reasons).toHaveLength(0);
  });

  it("다리 하나 건너 믹서와 조금 엮인 정도면 낮음", () => {
    const result = scoreRisk({
      center: null,
      flows: [flow("in", 9), flow("in", 1, null, { totalEth: 10, byCategory: { mixer: 1 } })],
    });
    // 0.7 × 0.5 × (1/10 × 1/10) = 0.0035 → 0점
    expect(result.score).toBeLessThan(20);
  });
});

describe("특별 규칙", () => {
  it("주소 자체가 해커면 최소 90점 (커뮤니티 자료도 이유에 표시)", () => {
    const result = scoreRisk({
      center: { category: "hacker", source: "tayvano", community: true },
      flows: [flow("out", 10)],
    });
    expect(result.score).toBe(90);
    expect(result.reasons[0]).toMatchObject({ kind: "self", community: true });
  });

  it("제재 주소로 보냈으면 먼지라도 최소 90점", () => {
    const result = scoreRisk({ center: null, flows: [flow("out", 100), flow("out", 0.001, "sanctioned")] });
    expect(result.score).toBe(90);
    expect(result.reasons[0]).toMatchObject({ kind: "sent-sanctioned", points: 90 });
  });

  it("나쁜 곳으로 보낸 돈은 먼지라도 셈 (받은 먼지만 무시)", () => {
    const result = scoreRisk({ center: null, flows: [flow("out", 0.005, "mixer")] });
    expect(result.score).toBe(70);
    expect(result.sides.out.totalEth).toBe(0.005);
    const hacker = scoreRisk({ center: null, flows: [flow("out", 0.005, "hacker")] });
    expect(hacker.score).toBe(90);
    const received = scoreRisk({ center: null, flows: [flow("in", 0.005, "mixer")] });
    expect(received.score).toBe(0);
    expect(received.sides.in.totalEth).toBe(0);
  });

  it("제재 주소에서 먼지만 받았으면 0점", () => {
    const result = scoreRisk({ center: null, flows: [flow("in", 0.009, "sanctioned"), flow("in", 5)] });
    expect(result.score).toBe(0);
  });

  it("거래소·믹서 라벨인 주소 자체엔 최소 점수 없음", () => {
    expect(scoreRisk({ center: { category: "exchange", source: "x", community: false }, flows: [] }).score).toBe(0);
    expect(scoreRisk({ center: { category: "mixer", source: "x", community: false }, flows: [] }).score).toBe(0);
  });

  it("해킹 피해 지갑은 해커에게 보낸 돈을 빼고 계산 (제재 주소로 보낸 건 그대로)", () => {
    const victim = { category: "victim" as const, source: "CertiK", community: false };
    const stolen = scoreRisk({ center: victim, flows: [flow("out", 400_000, "hacker"), flow("out", 10)] });
    expect(stolen.victim).toBe(true);
    expect(stolen.score).toBe(0);
    expect(stolen.sides.out.totalEth).toBe(10);
    const viaWallet = scoreRisk({
      center: victim,
      flows: [flow("out", 400_000, null, { totalEth: 400_000, byCategory: { hacker: 400_000 } })],
    });
    expect(viaWallet.score).toBe(0);
    const sanctioned = scoreRisk({ center: victim, flows: [flow("out", 100), flow("out", 0.01, "sanctioned")] });
    expect(sanctioned.score).toBe(90);
  });

  it("경로가 아무리 많아도 100점을 넘지 않음", () => {
    const result = scoreRisk({
      center: { category: "sanctioned", source: "OFAC", community: false },
      flows: [flow("in", 10, "sanctioned"), flow("out", 10, "sanctioned"), flow("out", 10, "hacker")],
    });
    expect(result.score).toBe(100);
  });
});

describe("계산 성질", () => {
  it("같은 쪽 이유들의 '더해진 점수'를 다 더하면 그쪽 점수", () => {
    for (const fixture of [bybit, ronin, upbit] as Fixture[]) {
      const result = scoreRisk(fixture.input);
      for (const side of ["in", "out"] as const) {
        const added = result.reasons
          .filter((r) => r.kind === "exposure" && r.side === side)
          .reduce((sum, r) => sum + (r.kind === "exposure" ? r.added : 0), 0);
        expect(added).toBe(result.sides[side].score);
      }
    }
  });

  it("확인 범위: 라벨 있는 상대 + 한 단계 더 본 상대의 비율", () => {
    const result = scoreRisk({
      center: null,
      flows: [flow("in", 2, "exchange"), flow("in", 3, null, { totalEth: 0, byCategory: {} }), flow("in", 5)],
    });
    expect(result.sides.in.coverage).toBeCloseTo(0.5);
  });

  it("소수 오차로 1점 틀리지 않음: 믹서 15% → 0.7 × 0.15 = 10.5 → 11점", () => {
    const result = scoreRisk({ center: null, flows: [flow("in", 15, "mixer"), flow("in", 85)] });
    expect(result.sides.in.score).toBe(11);
    expect(result.reasons[0]).toMatchObject({ points: 11, added: 11 });
  });

  it("이유 순서 = '더해진 점수'를 계산한 순서 (반올림 점수가 같아도)", () => {
    // 1단계 해커 20.3% (0.1827) vs 2단계 믹서 52% (0.182): 둘 다 18점
    const result = scoreRisk({
      center: null,
      flows: [
        flow("in", 20.3, "hacker"),
        flow("in", 52, null, { totalEth: 52, byCategory: { mixer: 52 } }),
        flow("in", 27.7),
      ],
    });
    const [first, second] = result.reasons;
    expect(first).toMatchObject({ category: "hacker", points: 18, added: 18 });
    expect(second).toMatchObject({ category: "mixer", points: 18, added: 15 });
  });

  it("등급 경계", () => {
    expect(gradeOf(0).name).toBe("낮음");
    expect(gradeOf(19).name).toBe("낮음");
    expect(gradeOf(20).name).toBe("보통");
    expect(gradeOf(49).name).toBe("보통");
    expect(gradeOf(50).name).toBe("높음");
    expect(gradeOf(79).name).toBe("높음");
    expect(gradeOf(80).name).toBe("매우 높음");
    expect(gradeOf(100).name).toBe("매우 높음");
  });
});
