"use client";

import type { Ref } from "react";

// 분할 버튼: 2D/3D, 주요 거래/전체, 전체/받음/보냄을 같은 모양으로
// 고른 칸 = 흰 바탕 + 진한 테두리 + 굵게 (색만으로 구분하지 않음). 고대비 모드는 시스템 강조색
export type SegmentOption<T extends string> = { value: T; label: string; count?: number };

export default function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  buttonRef,
  className = "",
}: {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  buttonRef?: (value: T) => Ref<HTMLButtonElement> | undefined; // 포커스를 되돌릴 칸 (예: 3D 창을 닫으면 '3D'로)
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex shrink-0 rounded-lg border border-line-control bg-surface-2 p-0.5 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={buttonRef?.(option.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`focus-ring inline-flex h-[30px] items-center gap-1.5 rounded-md border px-[11px] text-sm whitespace-nowrap transition-colors pointer-coarse:h-10 ${
              active
                ? "border-fg bg-surface font-semibold text-fg forced-colors:border-[color:Highlight] forced-colors:bg-[color:Highlight] forced-colors:text-[color:HighlightText] forced-colors:forced-color-adjust-none"
                : "border-transparent font-medium text-fg-2 hover:text-fg"
            }`}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={`text-xs num ${active ? "text-fg-2" : "text-muted"} forced-colors:text-inherit`}
              >
                {option.count.toLocaleString("en-US")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
