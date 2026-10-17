import type { Metadata } from "next";
import Link from "next/link";
import DemoCards from "@/components/DemoCards";
import { ArrowLeftIcon, InfoIcon } from "@/components/icons";
import SearchBox from "@/components/SearchBox";
import { buttonClass } from "@/components/ui/button";
import { demoSummaries } from "@/lib/demo-summaries";

export const metadata: Metadata = { title: "페이지를 찾을 수 없어요" };

// 404: 가운데 한 단 + 검색칸 + 데모 바로가기 (막다른 길이 되지 않게)
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-14 pb-16 sm:px-6 sm:pt-24">
      <InfoIcon className="size-5 text-muted" />
      <p className="mt-3 font-mono text-xs text-muted">404</p>
      <h1 className="mt-1 text-3xl font-bold tracking-[-0.025em] text-fg">페이지를 찾을 수 없어요</h1>
      <p className="mt-3 text-base text-fg-2">주소가 바뀌었거나 없는 페이지예요. 추적할 주소를 넣거나 데모로 둘러보세요.</p>
      <div className="mt-7">
        <SearchBox />
      </div>
      <p className="mt-6 text-sm font-semibold text-fg">데모로 둘러보기</p>
      <div className="mt-3">
        <DemoCards summaries={demoSummaries()} compact />
      </div>
      <Link href="/" className={buttonClass({ variant: "secondary", className: "mt-8" })}>
        <ArrowLeftIcon className="size-4 text-muted" />
        처음으로
      </Link>
    </div>
  );
}
