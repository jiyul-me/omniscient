// 버튼 모양 한 벌 (button·Link·a에 같이 씀). 높이는 sm 36 / md 40 / lg 48, 손가락 기기는 44 이상
// primary = 청록 바탕(주 버튼 하나), secondary = 흰 바탕 + 테두리, ghost = 테두리 없음
type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const BASE =
  "focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent font-semibold text-white hover:bg-accent-strong",
  secondary: "border border-line-control bg-surface font-medium text-fg hover:bg-surface-2",
  ghost: "font-medium text-fg-2 hover:bg-surface-2 hover:text-fg",
};

const SIZE: Record<Size, string> = {
  sm: "h-9 px-3 text-sm pointer-coarse:h-11",
  md: "h-10 px-4 text-sm pointer-coarse:h-11",
  lg: "h-12 px-[22px] text-base",
};

// 아이콘만 있는 정사각형 버튼 (aria-label 필수)
const ICON_SIZE: Record<Size, string> = {
  sm: "size-9 pointer-coarse:size-11",
  md: "size-10 pointer-coarse:size-11",
  lg: "size-12",
};

export function buttonClass({
  variant = "secondary",
  size = "md",
  icon = false,
  className = "",
}: { variant?: Variant; size?: Size; icon?: boolean; className?: string } = {}) {
  return `${BASE} ${VARIANT[variant]} ${icon ? ICON_SIZE[size] : SIZE[size]} ${className}`.trim();
}
