// 시간 슬라이더: 송금 선이 처음 생긴 시각 순서대로 돈이 퍼져 나가는 걸 다시 보여줌
// 순수 함수라 단위 테스트(lib/timeline.test.ts)로 확인. 브라우저(FlowGraph)에서 씀 → 무거운 의존성 금지

// 그래프 라이브러리가 선의 source/target을 점 객체로 바꿔 넣어서 둘 다 받음
type End = string | { id?: string | number };
export type TimedLink = { id: string; source: End; target: End; firstAt?: number };

export function endKey(end: End) {
  return typeof end === "object" ? String(end.id) : end;
}

// 재생 단계가 너무 많으면 한 번 재생이 길어져서 고르게 줄임
export const MAX_STEPS = 120;

// 재생 단계 = 서로 다른 '처음 송금 시각'을 오래된 순으로 (처음·마지막 시각은 꼭 포함)
export function timelineSteps(links: TimedLink[]): number[] {
  const times = [
    ...new Set(links.map((link) => link.firstAt).filter((t): t is number => Number.isFinite(t))),
  ].sort((a, b) => a - b);
  if (times.length <= MAX_STEPS) return times;
  return Array.from(
    { length: MAX_STEPS },
    (_, i) => times[Math.round((i * (times.length - 1)) / (MAX_STEPS - 1))],
  );
}

// cutoff 시각까지 생긴 선만 따라 시작 주소에서 이어지는 점·선
// (나중에 생긴 선 너머의 점은 아직 안 보임. 시각이 없는 선은 늘 보임)
export function visibleAt(links: TimedLink[], centerId: string, cutoff: number) {
  const neighbors = new Map<string, { node: string; link: string }[]>();
  const connect = (from: string, to: string, link: string) => {
    const list = neighbors.get(from) ?? [];
    list.push({ node: to, link });
    neighbors.set(from, list);
  };
  for (const link of links) {
    if (Number.isFinite(link.firstAt) && (link.firstAt as number) > cutoff) continue;
    const a = endKey(link.source);
    const b = endKey(link.target);
    connect(a, b, link.id);
    connect(b, a, link.id);
  }
  const nodes = new Set([centerId]);
  const shown = new Set<string>();
  const queue = [centerId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const { node, link } of neighbors.get(id) ?? []) {
      shown.add(link);
      if (!nodes.has(node)) {
        nodes.add(node);
        queue.push(node);
      }
    }
  }
  return { nodes, links: shown };
}
