import { describe, expect, it } from "vitest";
import { addressGroups, formatEthSummary } from "./format";

describe("요약 숫자용 ETH 금액", () => {
  it("1 이상은 소수 둘째 자리 고정 (반올림)", () => {
    expect(formatEthSummary("182267.919400000000000000")).toBe("182,267.92");
    expect(formatEthSummary("182165.956")).toBe("182,165.96");
    expect(formatEthSummary("10000")).toBe("10,000.00");
    expect(formatEthSummary("1.995")).toBe("2.00");
  });
  it("1 미만은 유효숫자 4개", () => {
    expect(formatEthSummary("0.004213456")).toBe("0.004213");
    expect(formatEthSummary("0.5")).toBe("0.5");
    expect(formatEthSummary("0")).toBe("0");
  });
});

describe("주소 4글자 묶음", () => {
  it("0x 뒤 40글자를 10묶음으로", () => {
    const groups = addressGroups("0x098B716B8Aaf21512996dC57EB0615e2383E2f96");
    expect(groups).toHaveLength(10);
    expect(groups[0]).toBe("098B");
    expect(groups[9]).toBe("2f96");
    expect(groups.join("")).toBe("098B716B8Aaf21512996dC57EB0615e2383E2f96");
  });
});
