"use client";

import CategoryMark from "@/components/CategoryMark";
import { ArrowDownLeftIcon, ArrowUpRightIcon } from "@/components/icons";
import { labelStyle } from "@/lib/categories";
import { formatEth, formatPercent } from "@/lib/format";
import type { FlowSummary } from "@/lib/graph";

const SIDE_WORD = { in: "받은 돈", out: "보낸 돈" } as const;

function flowTitle({ side, category, count }: FlowSummary) {
  // 해킹 피해 지갑은 이름에 '지갑'이 있어서 '주소'를 붙이지 않음
  const base = category === "victim" ? labelStyle(category).name : `${labelStyle(category).name} 주소`;
  const name = `${base}${count > 1 ? ` ${count}곳` : ""}`;
  // 받침이 있으면 '으로' (곳으로·지갑으로), 없으면 '로' (주소로)
  const last = name.charCodeAt(name.length - 1);
  const batchim = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return side === "out" ? `${name}${batchim ? "으로" : "로"} 보냄` : `${name}에서 받음`;
}

// 그래프 옆 '주요 흐름': 라벨 있는 상대와 직접 오간 돈 요약 (글로 읽는 그래프). 누르면 그래프에서 그 점을 고름
// canPick = 그래프에 그 분류·방향의 점이 그려져 있는지 (없으면 글만). onPick이 없으면 글만 (그래프 로딩 화면)
export default function TopFlows({
  flows,
  canPick,
  onPick,
}: {
  flows: FlowSummary[];
  canPick?: (flow: FlowSummary) => boolean;
  onPick?: (flow: FlowSummary) => void;
}) {
  if (flows.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted">
        주요 흐름 <span className="font-normal print:hidden">· 누르면 그래프에서 골라요</span>
      </p>
      <ul className="mt-2 divide-y divide-line">
        {flows.map((flow) => {
          const content = (
            <>
              {flow.side === "in" ? (
                <ArrowDownLeftIcon className="mt-[3px] size-4 text-muted" />
              ) : (
                <ArrowUpRightIcon className="mt-[3px] size-4 text-muted" />
              )}
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm text-fg">
                  <CategoryMark category={flow.category} className="size-[13px]" />
                  {flowTitle(flow)}
                </span>
                <span className="mt-0.5 block text-xs text-muted num">
                  {formatEth(flow.valueEth)} 상당 · {SIDE_WORD[flow.side]}의 {formatPercent(flow.share)}
                </span>
              </span>
            </>
          );
          const key = `${flow.side}:${flow.category}`;
          return (
            <li key={key}>
              {onPick && canPick?.(flow) ? (
                <button
                  type="button"
                  onClick={() => onPick(flow)}
                  className="focus-ring-inset -mx-2 flex min-h-11 w-[calc(100%+1rem)] items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  {content}
                </button>
              ) : (
                <div className="flex min-h-11 items-start gap-2.5 py-2">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
