import "server-only";
import { DEMO_CASES, type DemoCase } from "./demos";
import type { LabelCategory } from "./categories";
import { getTag } from "./labels";
import { RISK } from "./risk-config";
import { loadSnapshot } from "./snapshots";

// 데모 카드에 보여줄 점수·등급·시작 주소 분류 (저장본에서 읽음, Alchemy 호출 0번)
export type DemoSummary = {
  demo: DemoCase;
  score: number | null;
  gradeName: string | null;
  warn: boolean;
  category: LabelCategory | null;
};

export function demoSummaries(): DemoSummary[] {
  return DEMO_CASES.map((demo) => {
    const risk = loadSnapshot(demo.id)?.risk;
    return {
      demo,
      score: risk?.score ?? null,
      gradeName: risk?.gradeName ?? null,
      warn: (risk?.score ?? 0) >= RISK.warnFrom,
      category: getTag(demo.address.toLowerCase())?.category ?? null,
    };
  });
}
