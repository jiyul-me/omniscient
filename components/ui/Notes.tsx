import type { ReactNode } from "react";
import { ChevronRightIcon, InfoIcon } from "@/components/icons";

// 안내 목록: 항목마다 아이콘 + 굵은 앞말 + 줄표. 3개 이상이면 첫 개만 보이고 나머지는 접음
export type Note = { lead?: string; text: ReactNode };

function Item({ note }: { note: Note }) {
  return (
    <li className="flex gap-2.5">
      <InfoIcon className="mt-[3px] size-4 text-muted" />
      <p className="min-w-0 max-w-[70ch]">
        {note.lead && <span className="font-semibold text-fg">{note.lead} — </span>}
        {note.text}
      </p>
    </li>
  );
}

export default function Notes({ notes, className = "" }: { notes: readonly Note[]; className?: string }) {
  if (notes.length === 0) return null;
  const [first, ...rest] = notes;
  const fold = notes.length >= 3;
  return (
    <div className={`text-sm text-fg-2 ${className}`}>
      <ul className="space-y-2.5">
        <Item note={first} />
        {!fold && rest.map((note, index) => <Item key={index} note={note} />)}
      </ul>
      {fold && (
        <details className="group mt-2.5">
          {/* 브라우저 기본 ▶ 표시는 숨기고 icons.tsx 아이콘으로 */}
          <summary className="focus-ring flex w-fit cursor-pointer list-none items-center gap-2.5 rounded-sm font-medium text-fg-2 hover:text-fg [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-4 text-muted group-open:rotate-90 motion-safe:transition-transform" />
            안내 {rest.length}개 더 보기
            {rest.some((note) => note.lead) && (
              <span className="text-muted"> ({rest.map((note) => note.lead).filter(Boolean).join(" · ")})</span>
            )}
          </summary>
          <ul className="mt-2.5 space-y-2.5">
            {rest.map((note, index) => (
              <Item key={index} note={note} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
