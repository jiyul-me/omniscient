"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";

// 주소 복사 버튼: 누르면 2초 동안 체크 표시 + 화면 읽기 프로그램에 '복사했어요'
export default function CopyButton({ text, label = "주소 복사" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => {
          navigator.clipboard
            ?.writeText(text)
            .then(() => setState("done"))
            .catch(() => setState("failed"));
        }}
        className={buttonClass({ variant: "ghost", size: "sm", icon: true, className: "text-muted print:hidden" })}
      >
        {state === "done" ? <CheckIcon className="size-4 text-fg" /> : <CopyIcon className="size-4" />}
      </button>
      <span role="status" className="sr-only">
        {state === "done" ? "주소를 복사했어요" : state === "failed" ? "복사하지 못했어요" : ""}
      </span>
    </>
  );
}
