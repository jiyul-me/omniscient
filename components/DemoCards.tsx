import Link from "next/link";
import CategoryMark from "@/components/CategoryMark";
import GradeChip from "@/components/GradeChip";
import { labelStyle } from "@/lib/categories";
import type { DemoSummary } from "@/lib/demo-summaries";
import { demoHref } from "@/lib/demos";

// 데모 카드: 이름·연도 / 한 줄 이야기 / 시작 주소 분류 + 등급 칩. compact = 오류·404 화면용 작은 카드
// 데모는 저장본으로 보여줘서(lib/snapshots.ts) 미리 불러와도 Alchemy를 쓰지 않음
export default function DemoCards({ summaries, compact = false }: { summaries: DemoSummary[]; compact?: boolean }) {
  return (
    <ul className={`grid gap-3 ${compact ? "grid-cols-2" : "sm:grid-cols-2"}`}>
      {summaries.map(({ demo, score, gradeName, category }) => (
        <li key={demo.id}>
          <Link
            href={demoHref(demo)}
            className="focus-ring group flex h-full flex-col rounded-xl border border-line-strong bg-surface transition-colors hover:border-line-control"
          >
            <span className={`flex items-baseline justify-between gap-2 ${compact ? "px-3.5 pt-3" : "px-4 pt-4"}`}>
              <span className={`${compact ? "text-sm" : "text-[17px]"} font-strong text-fg group-hover:underline group-hover:decoration-line-control group-hover:underline-offset-4`}>
                {demo.title}
              </span>
              <span className="text-xs text-muted num">{demo.date?.slice(0, 4) ?? demo.note}</span>
            </span>
            {!compact && <span className="mt-1.5 px-4 text-sm text-fg-2">{demo.story}</span>}
            <span
              className={`mt-auto flex items-center justify-between gap-2 ${compact ? "px-3.5 pt-2 pb-3" : "mt-3 border-t border-line px-4 py-3"}`}
            >
              {!compact && (
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                  <CategoryMark category={category} />
                  <span className="truncate">시작 주소 · {category ? labelStyle(category).name : "라벨 없음"}</span>
                </span>
              )}
              {score !== null && gradeName && <GradeChip score={score} gradeName={gradeName} withScore />}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
