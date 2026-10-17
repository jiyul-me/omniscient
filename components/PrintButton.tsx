"use client";

import { useEffect, useRef, useState } from "react";
import { PrinterIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";

// PDF로 저장: 브라우저 인쇄 창을 열면 'PDF로 저장'을 고를 수 있음. 모양은 app/globals.css의 @media print
// 인쇄 직전에 접힌 내용(<details>)을 펼치고 인쇄 시각·주소를 채움. Ctrl+P로 인쇄해도 똑같이
export default function PrintButton({ title, size = "md" }: { title: string; size?: "sm" | "md" }) {
  const fired = useRef(false);
  const savedTitle = useRef("");
  const opened = useRef<HTMLDetailsElement[]>([]);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const before = () => {
      fired.current = true;
      opened.current = [...document.querySelectorAll<HTMLDetailsElement>("details:not([open])")];
      opened.current.forEach((details) => (details.open = true));
      const stamp = document.getElementById("print-stamp");
      if (stamp) {
        stamp.textContent = new Intl.DateTimeFormat("ko-KR", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "Asia/Seoul",
        }).format(new Date());
      }
      const url = document.getElementById("print-url");
      if (url) url.textContent = window.location.href;
    };
    const after = () => {
      opened.current.forEach((details) => (details.open = false));
      opened.current = [];
      if (savedTitle.current) {
        document.title = savedTitle.current;
        savedTitle.current = "";
      }
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  function print() {
    fired.current = false;
    setBlocked(false);
    // 크롬은 저장할 PDF 파일 이름을 페이지 제목으로 정함
    savedTitle.current = document.title;
    document.title = title;
    window.print();
    // 카카오톡·네이버 앱 안 브라우저 등은 인쇄 창이 안 뜨기도 함 → 안내
    setTimeout(() => {
      if (fired.current) return;
      setBlocked(true);
      if (savedTitle.current) {
        document.title = savedTitle.current;
        savedTitle.current = "";
      }
    }, 1500);
  }

  return (
    <div className="relative print:hidden">
      <button type="button" onClick={print} className={buttonClass({ variant: "secondary", size })}>
        <PrinterIcon className="size-4 text-muted" />
        PDF로 저장
      </button>
      {blocked && (
        <p
          role="status"
          className="absolute top-full left-0 z-10 mt-1 w-56 sm:right-0 sm:left-auto rounded-lg border border-warn-line bg-warn-bg px-3 py-2 text-xs text-warn"
        >
          인쇄 창이 안 열렸어요. Chrome이나 Safari에서 열어 주세요.
        </p>
      )}
    </div>
  );
}
