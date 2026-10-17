import { CATEGORY_STYLE } from "@/lib/categories";

// 점 상태 한 줄 (첫 화면 범례): 시작 주소 이중 테두리 · 누르면 펼침 · 거래 많아 멈춤 · 선 위 점
export function StateLegendRow({ className = "" }: { className?: string }) {
  const dot = { backgroundColor: CATEGORY_STYLE.unknown.color };
  return (
    <ul className={`flex flex-wrap items-center gap-x-6 gap-y-2.5 text-sm text-fg-2 ${className}`}>
      <li className="text-xs font-semibold text-muted">점 상태</li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="relative size-4 shrink-0 rounded-full border-[1.5px] border-fg">
          <span className="absolute inset-[3px] rounded-full border border-fg" style={dot} />
        </span>
        시작 주소 (이중 테두리)
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center rounded-full border border-line-control">
          <span className="size-2.5 rounded-full" style={dot} />
        </span>
        누르면 펼침
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center rounded-full border border-dashed border-muted">
          <span className="size-2.5 rounded-full" style={dot} />
        </span>
        거래 많아 멈춤 (점선)
      </li>
      <li className="flex items-center gap-2">
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0">
          <path d="M1 8h14" stroke="#8f8c83" strokeWidth="1.5" />
          <circle cx="6" cy="8" r="1.6" fill="#3e434c" />
          <circle cx="11" cy="8" r="1.6" fill="#3e434c" />
        </svg>
        선 위의 점 = 돈이 흐르는 방향
      </li>
    </ul>
  );
}
