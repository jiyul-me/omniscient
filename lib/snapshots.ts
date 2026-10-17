import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DEMO_CASES, findDemo, type DemoCase } from "./demos";
import type { Prices } from "./alchemy";
import type { RiskReport } from "./exposure";
import type { ExpandResult, GraphData, Side } from "./graph";
import type { TransferHistory } from "./transfers";

// 데모 모드: 데모 사례는 미리 받아 둔 저장본(data/demos/<id>.json)으로 바로 보여줌
// → 발표 날 인터넷·Alchemy가 느려도 즉시 뜨고, 데모 버튼은 Alchemy 사용량을 쓰지 않음
// 저장본 만들기: 개발 서버를 켠 채로 `npm run demos` (scripts/save-demos.mts)

export type DemoSnapshot = {
  id: string;
  capturedAt: string; // 저장한 날 (한국 시간, YYYY-MM-DD)
  input: string; // 저장할 때 넣은 글자 (주소 또는 ENS 이름)
  ensName: string | null;
  prices?: Prices | null; // 저장할 때 쓴 시세 (표의 금액순 정렬·주요 흐름용). 없으면 근사값
  history: TransferHistory;
  graph: GraphData;
  risk: RiskReport;
  // 처음 그래프에서 누를 수 있는 점마다 한 단계 펼친 결과 (key = expansionKey)
  expansions: Record<string, ExpandResult>;
};

export function expansionKey(address: string, side: Side, hop: number) {
  return `${address.toLowerCase()}:${side}:${hop}`;
}

// 한 번 읽어 두고 계속 씀 (next.config.ts의 outputFileTracingIncludes로 배포물에 포함)
// 없을 때는 기억하지 않음 → npm run demos로 새로 저장하면 서버를 다시 켜지 않아도 보임
const loaded = new Map<string, DemoSnapshot>();

export function loadSnapshot(id: string): DemoSnapshot | null {
  // 아는 데모 이름만 (주소창의 ?demo= 값으로 다른 파일을 읽지 못하게)
  if (!DEMO_CASES.some((demo) => demo.id === id)) return null;
  const cached = loaded.get(id);
  if (cached) return cached;
  try {
    const file = path.join(process.cwd(), "data", "demos", `${id}.json`);
    const snapshot = JSON.parse(readFileSync(file, "utf8")) as DemoSnapshot;
    loaded.set(id, snapshot);
    return snapshot;
  } catch {
    return null; // 저장본이 없으면 실시간으로
  }
}

// 넣은 글자가 데모 사례이고 저장본이 있으면 둘 다 돌려줌
export function findSnapshot(input: string): { demo: DemoCase; snapshot: DemoSnapshot } | null {
  const demo = findDemo(input);
  const snapshot = demo ? loadSnapshot(demo.id) : null;
  return demo && snapshot ? { demo, snapshot } : null;
}
