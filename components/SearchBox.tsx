"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { AlertIcon, SearchIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { queryProblem, traceHref } from "@/lib/query";

// 큰 검색칸 (첫 화면·오류 화면). 입력칸에 키보드 포커스가 오면 칸 전체에 청록 테두리
export default function SearchBox({ initialValue = "", hint }: { initialValue?: string; hint?: string }) {
  const router = useRouter();
  const id = useId();
  const [query, setQuery] = useState(initialValue);
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    const problem = queryProblem(value);
    if (problem) {
      setNotice(problem);
      return;
    }
    startTransition(() => router.push(traceHref(value)));
  }

  return (
    <div className="w-full">
      <form
        role="search"
        onSubmit={handleSubmit}
        className="flex h-14 items-center gap-2 rounded-xl border border-line-control bg-surface py-1.5 pr-1.5 pl-4 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent sm:h-[60px]"
      >
        <SearchIcon className="size-5 text-muted" />
        <label htmlFor={id} className="sr-only">
          지갑 주소 또는 ENS 이름
        </label>
        <input
          id={id}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setNotice("");
          }}
          placeholder="0x로 시작하는 주소나 이름.eth"
          aria-invalid={notice ? true : undefined}
          aria-describedby={`${id}-notice`}
          enterKeyHint="go"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-full min-w-0 flex-1 bg-transparent font-mono text-base text-fg placeholder:font-sans placeholder:text-muted focus:outline-hidden"
        />
        <button
          type="submit"
          disabled={isPending}
          className={buttonClass({ variant: "primary", size: "lg", className: "h-full! px-5 sm:px-[22px]" })}
        >
          {isPending ? "추적 중…" : "추적"}
        </button>
      </form>
      <p id={`${id}-notice`} role="status" className="mt-2 min-h-[22px] text-sm">
        {notice ? (
          <span className="flex items-start gap-1.5 text-warn">
            <AlertIcon className="mt-[3px] size-4" />
            {notice}
          </span>
        ) : (
          hint && <span className="text-muted">{hint}</span>
        )}
      </p>
    </div>
  );
}
