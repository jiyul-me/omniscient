import CategoryMark from "@/components/CategoryMark";
import { labelStyle, type LabelCategory } from "@/lib/categories";

// 분류 배지: 모양 표시 + 분류 이름 (결과 화면 머리말)
export default function CategoryBadge({ category }: { category: LabelCategory }) {
  return (
    <span className="inline-flex h-[30px] shrink-0 items-center gap-2 rounded-md border border-line-strong bg-surface px-2.5 text-[15px] font-semibold text-fg">
      <CategoryMark category={category} className="size-4" />
      {labelStyle(category).name}
    </span>
  );
}
