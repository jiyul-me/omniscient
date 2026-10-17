import CategoryMark from "@/components/CategoryMark";
import { CATEGORY_ORDER, CATEGORY_STYLE, legendName } from "@/lib/categories";

// 그래프 판 위 띠의 범례: '분류' 6개만 (점 상태는 '점 모양 읽는 법'에서). FlowGraph와 로딩 화면이 같이 씀
export default function GraphLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs">
      <span className="font-semibold text-muted">분류</span>
      <ul className="contents">
        {CATEGORY_ORDER.map((category) => (
          <li key={category} className="flex items-center gap-1.5 text-fg-2">
            <CategoryMark category={category} className="size-[13px]" />
            {legendName(category)}
          </li>
        ))}
      </ul>
    </div>
  );
}

// '점 모양 읽는 법': 점 상태 표시 설명 (2D에만 그리는 테두리는 3D에서 숨김)
export function StateLegend({ showStateMarks = true, showParticles = true }: { showStateMarks?: boolean; showParticles?: boolean }) {
  return (
    <details className="group relative">
      <summary className="focus-ring cursor-pointer list-none rounded-sm text-xs font-medium text-fg-2 underline decoration-line-control underline-offset-4 hover:text-fg [&::-webkit-details-marker]:hidden">
        점 모양 읽는 법
      </summary>
      <ul className="absolute top-full left-0 z-20 mt-2 w-72 space-y-2.5 rounded-lg border border-line-control bg-surface p-3.5 text-xs text-fg-2 print:static print:mt-2 print:w-auto print:border-0 print:p-0">
        <li className="flex items-center gap-2.5">
          <span aria-hidden="true" className="relative size-4 shrink-0 rounded-full border-[1.5px] border-fg">
            <span className="absolute inset-[3px] rounded-full border border-fg" style={{ backgroundColor: CATEGORY_STYLE.unknown.color }} />
          </span>
          시작 주소 (이중 테두리)
        </li>
        {showStateMarks && (
          <>
            <li className="flex items-center gap-2.5">
              <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center rounded-full border border-line-control">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: CATEGORY_STYLE.unknown.color }} />
              </span>
              누르면 한 단계 더 펼쳐짐 (얇은 테두리)
            </li>
            <li className="flex items-center gap-2.5">
              <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center rounded-full border border-dashed border-muted">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: CATEGORY_STYLE.unknown.color }} />
              </span>
              거래가 1,000건 넘어서 멈춤 (점선 테두리)
            </li>
          </>
        )}
        {showParticles && (
          <li className="flex items-center gap-2.5">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0">
              <path d="M1 8h14" stroke="#8f8c83" strokeWidth="1.5" />
              <circle cx="6" cy="8" r="1.6" fill="#3e434c" />
              <circle cx="11" cy="8" r="1.6" fill="#3e434c" />
            </svg>
            선 위의 점 = 돈이 흐르는 방향
          </li>
        )}
        <li className="text-muted">분류마다 색과 모양이 달라서 색을 구분하기 어려워도 모양으로 알아볼 수 있어요.</li>
      </ul>
    </details>
  );
}
