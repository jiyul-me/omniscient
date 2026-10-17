import CategoryMark from "@/components/CategoryMark";
import DemoCards from "@/components/DemoCards";
import ResultPreview from "@/components/ResultPreview";
import SearchBox from "@/components/SearchBox";
import { StateLegendRow } from "@/components/StateLegendRow";
import { CATEGORY_ORDER, CATEGORY_STYLE, legendName } from "@/lib/categories";
import { demoSummaries } from "@/lib/demo-summaries";

const STEPS = [
  { title: "주소 넣기", text: "0x 주소나 .eth 이름을 넣으면 이더리움 메인넷의 공개 송금 기록을 가져와요." },
  { title: "흐름 그래프", text: "들어온 돈은 왼쪽, 나간 돈은 오른쪽이에요. 점을 누르면 한 단계 더 따라가요." },
  { title: "점수와 이유", text: "제재·해커·믹서 주소와 얼마나 얽혔는지 0~100점과 그 이유를 보여줘요." },
];

export default function Home() {
  const summaries = demoSummaries();
  const hacks = summaries.filter((s) => s.demo.kind === "hack").length;
  return (
    // data-home: 머리말의 작은 검색칸을 숨기는 표시 (app/globals.css)
    <div data-home>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-14 sm:px-6 sm:pt-[72px] lg:grid-cols-[minmax(0,1fr)_452px] lg:gap-14">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">이더리움 자금 흐름 추적</p>
          <h1 className="mt-3 text-[32px] leading-[42px] font-bold tracking-[-0.03em] text-fg sm:text-5xl sm:leading-[58px]">
            돈이 어디서 와서
            <br />
            어디로 갔는지
          </h1>
          <p className="mt-4 max-w-[34em] text-base text-fg-2 sm:text-lg sm:leading-[31px]">
            이더리움 지갑 주소를 넣으면 움직이는 그래프로 자금 흐름을 보여주고, 위험 신호를 0~100점과 그 이유로
            알려드려요.
          </p>
          <div className="mt-7">
            <SearchBox hint="예: 0x로 시작하는 42글자 주소, 또는 vitalik.eth 같은 이름" />
          </div>
          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-base font-strong text-fg">데모 사례</h2>
            <p className="text-xs text-muted">
              공공기관이 공개한 사건 {hacks}개 + 정상 비교 {summaries.length - hacks}개 · 미리 저장해 둬서 바로 떠요
            </p>
          </div>
          <div className="mt-3">
            <DemoCards summaries={summaries} />
          </div>
        </div>
        <div className="min-w-0 lg:pt-1">
          <ResultPreview />
        </div>
      </section>

      <section aria-labelledby="steps-title" className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <h2 id="steps-title" className="sr-only">
          이렇게 보여줘요
        </h2>
        <ol className="grid gap-6 border-t-2 border-fg pt-6 md:grid-cols-3 md:gap-10">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <p className="font-mono text-sm text-muted num">0{index + 1}</p>
              <p className="mt-1 text-lg font-strong text-fg">{step.title}</p>
              <p className="mt-1.5 text-sm text-fg-2">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="legend-title" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="border-t border-line-strong pt-10">
          <h2 id="legend-title" className="text-xl font-strong tracking-[-0.015em] text-fg sm:text-2xl">
            그래프 점 읽는 법
          </h2>
          <p className="mt-1.5 text-[15px] text-fg-2">
            점의 색깔과 모양은 그 주소가 어떤 곳인지 알려줘요. 색을 구분하기 어려워도 모양으로 알아볼 수 있어요.
          </p>
          <ul className="mt-6 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORY_ORDER.map((category) => (
              <li key={category} className="border-t border-line pt-4">
                <p className="flex items-center gap-2.5 text-base font-semibold text-fg">
                  <CategoryMark category={category} className="size-4" />
                  {legendName(category)}
                </p>
                <p className="mt-1 pl-[26px] text-sm text-fg-2">{CATEGORY_STYLE[category].description}</p>
              </li>
            ))}
          </ul>
          <StateLegendRow className="mt-6 border-t border-line pt-4" />
        </div>
      </section>
    </div>
  );
}
