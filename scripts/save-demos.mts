// 데모 저장본 만들기
// 개발 서버를 켠 상태(npm run dev)에서: npm run demos   (다른 서버: BASE_URL=http://… npm run demos)
// 데모마다 /api/trace·/api/graph·/api/risk 결과와, 처음 그래프에서 누를 수 있는 점을 한 단계씩 펼친 결과를
// data/demos/<id>.json으로 저장 → lib/snapshots.ts가 읽어서 데모 버튼을 바로 보여줌 (Alchemy 호출 0번)
// 라벨(data/labels.json)을 다시 만들었거나 화면에 보이는 데이터 모양을 바꿨으면 다시 돌릴 것
import { mkdirSync, writeFileSync } from "node:fs";
import type { ExpandResult, GraphData, Side } from "../lib/graph";

// lib/demos.ts·lib/categories.ts를 그대로 씀 (Node 24는 .ts를 바로 실행. 타입은 확장자 없는 경로로 확인)
const { DEMO_CASES } = (await import(new URL("../lib/demos.ts", import.meta.url).href)) as typeof import("../lib/demos");
const { TERMINAL_CATEGORIES } = (await import(new URL("../lib/categories.ts", import.meta.url).href)) as typeof import("../lib/categories");

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT_DIR = new URL("../data/demos/", import.meta.url);
const CONCURRENCY = 2; // 서버의 Alchemy 동시 호출 수와 맞춤

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 429·5xx·네트워크 오류는 2초, 4초 기다렸다 다시 (3번까지)
async function get<T>(path: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${BASE}${path}`).catch(() => null);
    if (response?.ok) return (await response.json()) as T;
    const status = response?.status ?? 0;
    const retryable = status === 0 || status === 429 || status >= 500;
    if (!retryable || attempt >= 3) throw new Error(`${path} → HTTP ${status || "network error"}`);
    await sleep(2000 * attempt);
  }
}

// 그래프에서 누르면 서버에 펼치기를 요청하는 점: 펼칠 수 있는 주소 점 + 접힌 묶음 안의 주소들
function clickable(graph: GraphData) {
  const targets = new Map<string, { address: string; side: Side; hop: number }>();
  const add = (address: string, side: Side | null, hop: number) => {
    if (!side) return;
    targets.set(`${address}:${side}:${hop}`, { address, side, hop });
  };
  for (const node of graph.nodes) {
    if (node.kind === "address" && node.state === "expandable") add(node.id, node.side, node.hop);
    if (node.kind === "bundle") {
      // 펼친 묶음 안의 주소는 화면(FlowGraph unfoldBundle)과 같은 규칙: 종착역 라벨은 못 펼침
      for (const member of node.members ?? []) {
        const terminal = member.tag && TERMINAL_CATEGORIES.includes(member.tag.category);
        if (!terminal) add(member.id, node.side, node.hop);
      }
    }
  }
  return [...targets.entries()];
}

async function pool<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await worker(items[index]);
      }
    }),
  );
  return results;
}

const capturedAt = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
mkdirSync(OUT_DIR, { recursive: true });

for (const demo of DEMO_CASES) {
  const input = demo.ens ?? demo.address;
  const query = `address=${encodeURIComponent(input)}`;
  const started = performance.now();
  const { ensName, prices, ...history } = await get<{ ensName: string | null; prices: unknown } & Record<string, unknown>>(
    `/api/trace?${query}`,
  );
  const graph = await get<GraphData>(`/api/graph?${query}`);
  const risk = await get<Record<string, unknown>>(`/api/risk?${query}`);

  const targets = clickable(graph);
  const expanded = await pool(targets, async ([key, { address, side, hop }]) => {
    const params = new URLSearchParams({ address, side, hop: String(hop) });
    return [key, await get<ExpandResult>(`/api/graph/expand?${params}`)] as const;
  });

  const snapshot = {
    id: demo.id,
    capturedAt,
    input,
    ensName,
    prices,
    history,
    graph,
    risk,
    expansions: Object.fromEntries(expanded),
  };
  const json = JSON.stringify(snapshot);
  writeFileSync(new URL(`${demo.id}.json`, OUT_DIR), `${json}\n`);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(
    `${demo.id}: 점 ${graph.nodes.length}개, 펼치기 ${targets.length}곳, 점수 ${String(risk.score)}, ` +
      `${(json.length / 1024).toFixed(0)}KB, ${seconds}초`,
  );
}
console.log(`data/demos/*.json 저장 완료 (${capturedAt} 기준). 커밋하면 배포판 데모 버튼도 이 자료로 바뀌어요.`);
