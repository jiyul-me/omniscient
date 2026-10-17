import { CATEGORY_STYLE, labelStyle, type Category, type LabelCategory } from "@/lib/categories";
import { shapeOf, shapePath } from "@/lib/shapes";

export function categoryColor(category: string | null | undefined) {
  return category && category in CATEGORY_STYLE
    ? CATEGORY_STYLE[category as Category].color
    : labelStyle(category as LabelCategory | null | undefined).color;
}

// 분류 표시 = 색 + 모양 (그래프 점과 같은 모양). 범례·배지·표·패널이 같이 씀
// 색약이면 모양으로만 구분하니 12px(size-3)보다 작게 쓰지 않기
// 고대비 모드: 색은 그대로 두고 시스템 글자색 테두리를 둘러서 검은 바탕에서도 해커가 보이게
export default function CategoryMark({
  category,
  className = "size-3",
}: {
  category: string | null | undefined;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      overflow="visible"
      className={`shrink-0 forced-color-adjust-none ${className}`}
    >
      <path
        d={shapePath(shapeOf(category), 10, 10, 8.5)}
        fill={categoryColor(category)}
        strokeLinejoin="round"
        className="forced-colors:[stroke-width:1.5px] forced-colors:[stroke:CanvasText]"
      />
    </svg>
  );
}
