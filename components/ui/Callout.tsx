import type { ReactNode } from "react";
import { AlertIcon, InfoIcon } from "@/components/icons";

// 경고 상자(warn): 이 결과에만 해당하는 중요한 사실 (기록 1,000건 잘림, 확인한 돈 50% 미만, 조회 실패)
// 안내 상자(info): 알아 두면 좋은 사실. 둘 다 글 폭은 68ch까지
export default function Callout({
  tone = "info",
  title,
  children,
  className = "",
}: {
  tone?: "warn" | "info";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const warn = tone === "warn";
  return (
    <div
      className={`flex gap-2.5 rounded-lg px-4 py-3 text-sm ${
        warn
          ? "border border-l-4 border-warn-line border-l-warn-fill bg-warn-bg text-fg"
          : "bg-surface-2 text-fg-2 forced-colors:border forced-colors:border-[CanvasText]"
      } ${className}`}
    >
      {warn ? (
        <AlertIcon className="mt-[3px] size-4 text-warn" />
      ) : (
        <InfoIcon className="mt-[3px] size-4 text-muted" />
      )}
      <div className="min-w-0 max-w-[68ch]">
        {title && <p className="font-semibold text-fg">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
    </div>
  );
}
