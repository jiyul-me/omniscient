import SectionHead from "@/components/ui/SectionHead";
import { GraphIntro, GraphSkeleton } from "./GraphSection";
import { RiskIntro, RiskSkeleton } from "./RiskSection";

// 결과 화면(TraceResult)과 같은 틀·높이로 그려서, 데이터가 와도 화면이 덜컹거리지 않게
const BAR = "rounded-md bg-surface-2 motion-safe:animate-pulse";

// 사건 머리말 자리: 주소를 아직 모를 때만 (ENS 이름을 주소로 바꾸는 중)
export function TraceHeaderSkeleton() {
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted">추적한 주소</p>
        <div className={`mt-1.5 h-9 w-56 sm:h-[42px] ${BAR}`} />
        <div className={`mt-3.5 h-[54px] max-w-md sm:h-7 sm:max-w-lg ${BAR}`} />
      </div>
      <div className="flex gap-2">
        <div className="h-10 w-28 rounded-lg border border-line-control bg-surface" />
        <div className="h-10 w-40 rounded-lg border border-line-control bg-surface" />
      </div>
    </div>
  );
}

// 머리말 아래 전체 (점수·그래프·표). 맨 위에 눈에 띄는 상태 한 줄
export function TraceBodySkeleton() {
  return (
    <div aria-busy="true">
      {/* 이 리포트 목차 자리 (TraceResult의 ReportNav와 같은 높이) */}
      <div className="mt-7 hidden h-[46px] border-y border-line md:block" />
      <section className="mt-12">
        <RiskIntro />
        <p role="status" className="mt-5 rounded-xl border border-line-strong bg-surface px-5 py-4 text-[15px] leading-[26px] text-fg-2">
          블록체인에서 송금 기록을 가져오는 중이에요 · 보통 3~8초 걸려요
        </p>
        <div className="mt-3">
          <RiskSkeleton />
        </div>
        <div className="mt-6 h-[105px] border-y border-line" />
      </section>

      <section className="mt-14">
        <GraphIntro />
        <div className="mt-5">
          <GraphSkeleton />
        </div>
      </section>

      <section className="mt-14">
        <SectionHead number="03" title="송금 기록">
          블록체인에 남은 송금 기록이에요. 라벨이 있는 상대가 있으면 처음에는 라벨이 있는 상대와 금액이 큰 거래만 보여줘요.
        </SectionHead>
        <div className="mt-5 flex gap-3">
          <div className="h-[36px] w-44 rounded-lg border border-line-control bg-surface-2" />
          <div className="h-[36px] w-52 rounded-lg border border-line-control bg-surface-2" />
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-line-strong bg-surface">
          <div className="h-10 border-b border-line-strong bg-surface-2" />
          <div className="divide-y divide-line">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex h-[72px] items-center gap-6 px-4 md:h-12">
                <div className={`h-3 w-32 ${BAR}`} />
                <div className={`hidden h-3 w-12 md:block ${BAR}`} />
                <div className={`ml-auto h-3 w-24 ${BAR}`} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function TraceSkeleton() {
  return (
    <>
      <TraceHeaderSkeleton />
      <TraceBodySkeleton />
    </>
  );
}
