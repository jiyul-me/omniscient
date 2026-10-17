import type { ReactNode } from "react";

// 단원 머리: 위에 2px 진한 선 + 번호(01·02·03) + 제목 + 소개 한 문장 (보고서의 장처럼)
export default function SectionHead({
  number,
  title,
  titleId,
  children,
}: {
  number?: string;
  title: string;
  titleId?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`grid border-t-2 border-fg pt-[18px] ${number ? "grid-cols-[32px_minmax(0,1fr)] sm:grid-cols-[40px_minmax(0,1fr)]" : ""}`}
    >
      {number && <p className="pt-1.5 font-mono text-sm text-muted num">{number}</p>}
      <div>
        <h2 id={titleId} className="text-xl font-strong tracking-[-0.015em] text-fg sm:text-2xl">
          {title}
        </h2>
        {children && <p className="mt-1.5 max-w-[70ch] text-[15px] leading-[26px] text-fg-2">{children}</p>}
      </div>
    </div>
  );
}
