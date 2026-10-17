import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LabelCategory } from "./categories";

// scripts/build-labels.mts가 만든 data/labels.json을 읽어서 주소 → 라벨
type LabelFile = {
  generatedAt: string;
  sources: Record<
    string,
    { name: string; url: string; updated: string; license?: string; community?: boolean }
  >;
  labels: Record<string, [LabelCategory, string, string]>;
};

export type AddressTag = {
  category: LabelCategory;
  name: string;
  source: string; // 자료 이름
  sourceUrl: string;
  updated: string; // 자료가 마지막으로 바뀐 날
  community: boolean; // 커뮤니티 조사 자료 (틀릴 수 있음)
};

let file: LabelFile | null = null;

// 한 번 읽어 두고 계속 씀 (next.config.ts의 outputFileTracingIncludes로 배포물에 포함)
function load() {
  file ??= JSON.parse(
    readFileSync(path.join(process.cwd(), "data", "labels.json"), "utf8"),
  ) as LabelFile;
  return file;
}

export function getTag(address: string): AddressTag | null {
  const { labels, sources, generatedAt } = load();
  const entry = labels[address.toLowerCase()];
  if (!entry) return null;
  const [category, name, sourceId] = entry;
  const source = sources[sourceId];
  return {
    category,
    name,
    source: source?.name ?? sourceId,
    sourceUrl: source?.url ?? "",
    updated: source?.updated ?? generatedAt,
    community: Boolean(source?.community),
  };
}

export type LabelSource = {
  id: string;
  name: string;
  url: string;
  updated: string;
  license: string | null;
  community: boolean;
  counts: Partial<Record<LabelCategory, number>>; // 이 자료로 붙인 라벨 수 (분류별)
};

// 자료 출처 페이지(app/sources)용: 자료마다 이름·링크·날짜·라이선스와 실제로 쓴 라벨 수
export function labelSources(): { generatedAt: string; total: number; sources: LabelSource[] } {
  const { labels, sources, generatedAt } = load();
  const counts = new Map<string, Partial<Record<LabelCategory, number>>>();
  for (const [category, , sourceId] of Object.values(labels)) {
    const byCategory = counts.get(sourceId) ?? {};
    byCategory[category] = (byCategory[category] ?? 0) + 1;
    counts.set(sourceId, byCategory);
  }
  return {
    generatedAt,
    total: Object.keys(labels).length,
    sources: Object.entries(sources).map(([id, source]) => ({
      id,
      name: source.name,
      url: source.url,
      updated: source.updated,
      license: source.license ?? null,
      community: Boolean(source.community),
      counts: counts.get(id) ?? {},
    })),
  };
}
