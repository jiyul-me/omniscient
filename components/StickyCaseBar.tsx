"use client";

import { useEffect, useState } from "react";
import Address from "@/components/Address";
import GradeChip from "@/components/GradeChip";
import PrintButton from "@/components/PrintButton";
import { useCaseScore } from "@/components/caseScore";
import { SECTIONS } from "@/lib/case-sections";

// 결과 화면을 내리다 사건 머리말이 화면 밖으로 나가면 위에 붙는 띠: 이름·짧은 주소·등급·단원 바로가기·PDF로 저장
export default function StickyCaseBar({ name, address }: { name: string; address: string }) {
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const score = useCaseScore();

  useEffect(() => {
    const header = document.getElementById("case-header");
    if (!header) return;
    const observer = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // 지금 보고 있는 단원 = 화면 위쪽 1/3을 지나는 단원
  useEffect(() => {
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
        setActive(SECTIONS.find((section) => visible.get(section.id))?.id ?? null);
      },
      { rootMargin: "-64px 0px -66% 0px" },
    );
    for (const section of SECTIONS) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
    // 띠가 나타날 때 다시 찾음 (실시간 조회는 단원이 나중에 그려져서)
  }, [shown]);

  return (
    <div
      aria-hidden={!shown}
      inert={!shown}
      className={`fixed inset-x-0 top-0 z-30 border-b border-line-strong bg-surface transition-transform motion-reduce:transition-none print:hidden ${shown ? "translate-y-0" : "-translate-y-full"}`}
    >
      <div className="mx-auto flex h-[52px] max-w-6xl items-center gap-3 px-4 sm:px-6">
        <p className="min-w-[4.5rem] flex-1 truncate text-sm font-strong text-fg sm:flex-none">{name}</p>
        <Address address={address} variant="short" className="hidden text-xs text-fg-2 lg:inline" />
        {score && (
          <span className="hidden sm:inline-flex">
            <GradeChip score={score.score} gradeName={score.gradeName} withScore />
          </span>
        )}
        <nav aria-label="단원 바로가기" className="ml-auto flex h-full shrink-0 items-stretch">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={active === section.id ? "location" : undefined}
              className={`focus-ring-inset flex items-center border-b-2 px-2 text-sm whitespace-nowrap transition-colors sm:px-3 ${
                active === section.id ? "border-fg font-semibold text-fg" : "border-transparent text-fg-2 hover:text-fg"
              }`}
            >
              {section.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:block">
          <PrintButton title={`Omniscient 리포트 ${name}`} size="sm" />
        </div>
      </div>
    </div>
  );
}
