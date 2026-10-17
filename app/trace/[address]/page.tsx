import type { Metadata } from "next";
import { Suspense } from "react";
import TraceResult, { Breadcrumb } from "@/components/TraceResult";
import TraceSkeleton from "@/components/TraceSkeleton";

export const metadata: Metadata = {
  title: "송금 기록",
  robots: { index: false, follow: false },
};

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// 주소(params)·?live=1(searchParams)은 요청 때만 알 수 있어서 Suspense 안에서 읽음 (Cache Components 규칙)
export default function TracePage({ params, searchParams }: PageProps<"/trace/[address]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 pb-16 sm:px-6 sm:pt-6 print:max-w-none print:px-0 print:pt-0 print:pb-0">
      <Breadcrumb />
      <Suspense fallback={<TraceSkeleton />}>
        {Promise.all([params, searchParams]).then(([{ address }, query]) => (
          <TraceResult input={safeDecode(address)} live={query.live === "1"} />
        ))}
      </Suspense>
    </div>
  );
}
