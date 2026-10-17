import { AlertIcon } from "@/components/icons";
import { RISK } from "@/lib/risk-config";

// 등급 칩: 50점 이상은 호박색 경고 모양(+ 아이콘), 미만은 중립 테두리. 분류 6색은 안 씀
export default function GradeChip({
  score,
  gradeName,
  size = "sm",
  withScore = false,
}: {
  score: number;
  gradeName: string;
  size?: "sm" | "lg";
  withScore?: boolean;
}) {
  const warn = score >= RISK.warnFrom;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border whitespace-nowrap num ${
        size === "lg" ? "h-[34px] px-2.5 text-[15px]" : "h-[26px] px-2 text-xs"
      } ${warn ? "border-warn-fill bg-warn-bg font-semibold text-warn" : "border-line-control bg-surface font-medium text-fg-2"}`}
    >
      {warn && <AlertIcon className={size === "lg" ? "size-4" : "size-3.5"} />}
      {withScore && <span>{score}</span>}
      {gradeName}
    </span>
  );
}
