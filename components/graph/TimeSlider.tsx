"use client";

import { useId, type CSSProperties } from "react";
import { PauseIcon, PlayIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { formatKst } from "@/lib/format";

// 시간 슬라이더: 막대를 밀거나 재생하면 그 시각까지 생긴 송금 선만 보여줌 (lib/timeline.ts)
// cutoff = 이 시각까지 보여줌 (ms). null = 전부 (맨 끝). 막대 칸 = steps에서 cutoff 이하인 마지막 칸
export default function TimeSlider({
  steps,
  cutoff,
  onChange,
  playing,
  onTogglePlay,
  shownLinks,
  totalLinks,
}: {
  steps: number[];
  cutoff: number | null;
  onChange: (cutoff: number | null) => void;
  playing: boolean;
  onTogglePlay: () => void;
  shownLinks: number;
  totalLinks: number;
}) {
  const id = useId();
  if (steps.length < 2) return null;
  const last = steps.length - 1;
  const current = cutoff === null ? last : Math.max(0, steps.findLastIndex((time) => time <= cutoff));
  const time = formatKst(new Date(cutoff ?? steps[last]).toISOString());

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-4 py-3 print:hidden">
      {/* 이름(재생/멈춤)이 바뀌니 aria-pressed는 안 씀. 폭을 고정해서 바뀔 때 줄바꿈이 달라지지 않게 */}
      <button
        type="button"
        onClick={onTogglePlay}
        className={buttonClass({ variant: "secondary", size: "sm", className: "w-[7.5rem]" })}
      >
        {playing ? <PauseIcon className="size-3.5 text-muted" /> : <PlayIcon className="size-3.5 text-muted" />}
        {playing ? "멈춤" : "시간순 재생"}
      </button>
      <label htmlFor={id} className="sr-only">
        송금 시각 (막대를 밀면 그 시각까지 생긴 송금만 보여요)
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={last}
        step={1}
        value={current}
        onChange={(event) => {
          const value = Number(event.target.value);
          onChange(value >= last ? null : steps[value]);
        }}
        aria-valuetext={`한국 시간 ${time}까지, 송금 연결 ${shownLinks}개`}
        style={{ "--fill": `${(current / last) * 100}%` } as CSSProperties}
        className="graph-range focus-ring h-8 min-w-40 flex-1 cursor-pointer rounded-sm"
      />
      <p aria-hidden="true" className="text-xs text-muted num">
        <span className="font-semibold text-fg">{time}</span>까지 (한국 시간) · 송금 연결 {shownLinks}/{totalLinks}
      </p>
    </div>
  );
}
