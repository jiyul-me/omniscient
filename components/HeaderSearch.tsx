"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { AlertIcon, CloseIcon, SearchIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { queryProblem, traceHref } from "@/lib/query";

// 머리말의 작은 검색칸. '/' 키로 바로 입력. 휴대폰은 돋보기 버튼을 누르면 머리말 아래로 검색칸이 펼쳐짐
// 첫 화면엔 큰 검색칸이 있어서 숨김: 주소창(usePathname)을 읽으면 머리말이 정적으로 안 만들어져서
// 첫 화면에 있는 [data-home] 표시를 CSS(app/globals.css)로 보고 숨김
export default function HeaderSearch() {
  const router = useRouter();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (document.querySelector('[data-home]:not([style*="none"])')) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true], [role=application]")) return;
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    const problem = queryProblem(value);
    if (problem) {
      setNotice(problem);
      return;
    }
    setNotice("");
    setOpen(false);
    startTransition(() => router.push(traceHref(value)));
  }

  return (
    <div data-header-search className="contents">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-form`}
        aria-label={open ? "검색 닫기" : "다른 주소 추적"}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className={buttonClass({ variant: "ghost", size: "md", icon: true, className: "md:hidden" })}
      >
        {open ? <CloseIcon className="size-5" /> : <SearchIcon className="size-5" />}
      </button>
      <form
        id={`${id}-form`}
        role="search"
        onSubmit={submit}
        className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-full z-40 flex-col gap-1.5 border-b border-line-strong bg-surface px-4 py-3 md:static md:flex md:border-0 md:bg-transparent md:p-0 print:hidden`}
      >
        <div className="flex h-11 items-center gap-2 rounded-lg border border-line-control bg-surface pr-1.5 pl-3 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent md:h-10 md:w-[22rem] lg:w-[25rem]">
          <SearchIcon className="size-4 text-muted" />
          <label htmlFor={id} className="sr-only">
            다른 주소 추적: 지갑 주소 또는 ENS 이름
          </label>
          <input
            ref={inputRef}
            id={id}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setNotice("");
            }}
            placeholder="다른 주소 추적 · 0x… 또는 이름.eth"
            aria-invalid={notice ? true : undefined}
            aria-describedby={`${id}-notice`}
            enterKeyHint="go"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent font-mono text-base text-fg placeholder:font-sans placeholder:text-sm placeholder:text-muted focus:outline-hidden md:text-sm"
          />
          {isPending ? (
            <span className="text-xs text-muted">이동 중…</span>
          ) : (
            <kbd className="hidden rounded-sm border border-line-strong px-1.5 font-mono text-xs text-muted md:inline">
              /
            </kbd>
          )}
        </div>
        <p id={`${id}-notice`} role="status" className="text-sm text-warn empty:hidden md:absolute md:top-full md:mt-1 md:rounded-lg md:border md:border-warn-line md:bg-warn-bg md:px-3 md:py-1.5">
          {notice && (
            <span className="flex items-start gap-1.5">
              <AlertIcon className="mt-[3px] size-4" />
              {notice}
            </span>
          )}
        </p>
      </form>
    </div>
  );
}
