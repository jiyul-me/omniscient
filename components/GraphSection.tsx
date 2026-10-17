import { AlertIcon } from "@/components/icons";
import type { FlowSummary, GraphData } from "@/lib/graph";
import { buildGraph } from "@/lib/tracer";
import FlowGraph from "./FlowGraph";
import GraphLegend from "./GraphLegend";
import TopFlows from "./graph/TopFlows";
import SectionHead from "./ui/SectionHead";

// 그래프는 주소 여러 곳을 조회해서 몇 초 걸림 → 표와 따로 불러와서 표가 먼저 보이게 (TraceResult의 Suspense)
// saved = 데모 저장본 (있으면 조회 없이 바로, 점 펼치기도 저장본에서 먼저 찾음)
export default async function GraphSection({
  address,
  saved,
  topFlows,
}: {
  address: string;
  saved?: { graph: GraphData; demoId: string };
  topFlows: FlowSummary[];
}) {
  if (saved) return <FlowGraph data={saved.graph} demoId={saved.demoId} topFlows={topFlows} />;
  const data = await buildGraph(address).catch(() => null);
  if (!data) {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-line bg-surface px-4 py-6 text-sm text-warn">
        <AlertIcon className="mt-0.5 size-4" />
        그래프를 그리지 못했어요. 잠시 후 새로 고침해 주세요. (아래 송금 기록 표는 그대로 볼 수 있어요)
      </p>
    );
  }
  return <FlowGraph data={data} topFlows={topFlows} />;
}

// 단원 머리 (결과 화면과 로딩 화면이 같이 씀 → 높이가 같게)
export function GraphIntro({ titleId }: { titleId?: string }) {
  return (
    <SectionHead number="02" title="자금 흐름 그래프" titleId={titleId}>
      왼쪽은 돈이 들어온 곳, 오른쪽은 나간 곳이에요. 금액이 큰 주소는 2단계까지 미리 펼쳐 두었고, 점을 누르면 한 단계
      더 따라가요.
    </SectionHead>
  );
}

// FlowGraph와 같은 판·띠로 높이를 맞춤 → 그래프가 와도 아래 표가 밀리지 않게 (안내 글 줄 수는 주소마다 달라서 한 줄만)
export function GraphSkeleton({ topFlows = [] }: { topFlows?: FlowSummary[] }) {
  return (
    <div aria-busy="true">
      <div className="rounded-xl border border-line-strong bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line px-4 py-3">
          <div aria-hidden="true" className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <GraphLegend />
            <span className="text-xs font-medium text-fg-2 underline decoration-line-control underline-offset-4">점 모양 읽는 법</span>
          </div>
          {/* 2D/3D 전환 + 확대·축소·맞춤 버튼 자리 (FlowGraph 도구 막대와 같은 글자·크기) */}
          <div aria-hidden="true" className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-line-control bg-surface-2 p-0.5">
              <span className="inline-flex h-[30px] items-center rounded-md border border-fg bg-surface px-[11px] text-sm font-semibold text-fg pointer-coarse:h-10">2D</span>
              <span className="inline-flex h-[30px] items-center rounded-md border border-transparent px-[11px] text-sm font-medium text-fg-2 pointer-coarse:h-10">3D</span>
            </div>
            <span className="mx-1 h-6 w-px bg-line-strong" />
            <div className="size-9 rounded-lg border border-line-control pointer-coarse:size-11" />
            <div className="size-9 rounded-lg border border-line-control pointer-coarse:size-11" />
            <div className="size-9 rounded-lg border border-line-control pointer-coarse:size-11" />
          </div>
        </div>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex h-[420px] items-center justify-center bg-dot-grid px-6 text-center sm:h-[520px]">
            <p role="status" className="text-sm text-fg-2 motion-safe:animate-pulse">
              그래프를 그리는 중이에요… 주소 여러 곳을 조회해서 몇 초 걸려요.
            </p>
          </div>
          {/* 옆 칸: 주요 흐름은 송금 기록으로 이미 알아서 그대로 그림 (그래프가 와도 높이가 같게) */}
          <div className="flex min-h-[120px] flex-col gap-5 border-t border-line p-4 lg:border-t-0 lg:border-l">
            <p className="invisible text-sm">점을 누르면 여기에 자세한 내용이 나와요. 끌어서 옮기고, Ctrl(맥은 ⌘)을 누른 채 휠로 확대해요.</p>
            <TopFlows flows={topFlows} />
          </div>
        </div>
        {/* 시간 슬라이더 자리 (components/graph/TimeSlider.tsx와 같은 줄바꿈) */}
        <div aria-hidden="true" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-4 py-3">
          <div className="h-9 w-[7.5rem] shrink-0 rounded-lg border border-line-control pointer-coarse:h-11" />
          <div className="h-8 min-w-40 flex-1" />
          <p className="invisible text-xs num">2026-01-01 00:00까지 (한국 시간) · 송금 연결 00/00</p>
        </div>
      </div>
      <div className="mt-4 h-7" />
    </div>
  );
}
