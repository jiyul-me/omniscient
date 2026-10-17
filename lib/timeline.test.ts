// 시간 슬라이더 계산 단위 테스트. 실행: npm test
import { describe, expect, it } from "vitest";
import { MAX_STEPS, timelineSteps, visibleAt, type TimedLink } from "./timeline";

const link = (source: string, target: string, firstAt?: number): TimedLink => ({
  id: `${source}->${target}`,
  source,
  target,
  ...(firstAt === undefined ? {} : { firstAt }),
});

describe("재생 단계", () => {
  it("서로 다른 처음 시각을 오래된 순으로 (같은 시각은 한 번)", () => {
    expect(timelineSteps([link("c", "a", 30), link("c", "b", 10), link("a", "d", 30), link("c", "e")])).toEqual([10, 30]);
  });

  it("너무 많으면 MAX_STEPS개로 줄이되 처음·마지막은 남김", () => {
    const links = Array.from({ length: 500 }, (_, i) => link("c", `n${i}`, i * 1000));
    const steps = timelineSteps(links);
    expect(steps).toHaveLength(MAX_STEPS);
    expect(steps[0]).toBe(0);
    expect(steps.at(-1)).toBe(499_000);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
  });
});

describe("그 시각까지 보이는 점·선", () => {
  // 시작 주소 c → a (시각 20), a → b (시각 10: a가 c에게 받기 전에 먼저 보낸 돈), c → d (시각 30)
  const links = [link("c", "a", 20), link("a", "b", 10), link("c", "d", 30)];

  it("시작 주소와 이어진 선이 생겨야 그 너머 점이 보임", () => {
    const at10 = visibleAt(links, "c", 10);
    expect([...at10.nodes]).toEqual(["c"]);
    expect(at10.links.size).toBe(0);
    const at20 = visibleAt(links, "c", 20);
    expect([...at20.nodes].sort()).toEqual(["a", "b", "c"]);
    expect([...at20.links].sort()).toEqual(["a->b", "c->a"]);
  });

  it("마지막 시각이면 모두 보임", () => {
    const all = visibleAt(links, "c", 30);
    expect(all.nodes.size).toBe(4);
    expect(all.links.size).toBe(3);
  });

  it("시각이 없는 선(예전 저장본)은 늘 보임", () => {
    const result = visibleAt([link("c", "x")], "c", -Infinity);
    expect([...result.nodes].sort()).toEqual(["c", "x"]);
  });

  it("점을 펼쳐 선이 늘어도 같은 시각에 보이던 점은 그대로 (슬라이더는 칸 번호가 아니라 시각을 기억)", () => {
    const before = visibleAt(links, "c", 20);
    // a를 펼쳤더니 예전(시각 5) 받은 돈이 나와서 단계가 앞쪽에 하나 늘어남
    const expanded = [...links, link("e", "a", 5)];
    expect(timelineSteps(expanded)[1]).not.toBe(timelineSteps(links)[1]);
    const after = visibleAt(expanded, "c", 20);
    for (const node of before.nodes) expect(after.nodes.has(node)).toBe(true);
    expect(after.nodes.has("e")).toBe(true);
  });

  it("그래프 라이브러리가 source/target을 점 객체로 바꿔도 같게", () => {
    const mutated: TimedLink[] = [{ id: "c->a", source: { id: "c" }, target: { id: "a" }, firstAt: 5 }];
    expect([...visibleAt(mutated, "c", 5).nodes].sort()).toEqual(["a", "c"]);
  });
});
