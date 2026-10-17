import Link from "next/link";
import { Suspense } from "react";
import Address from "@/components/Address";
import CategoryBadge from "@/components/CategoryBadge";
import CopyButton from "@/components/CopyButton";
import DemoCards from "@/components/DemoCards";
import {
  AlertIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ChevronRightIcon,
  ExternalIcon,
  InfoIcon,
  RefreshIcon,
} from "@/components/icons";
import SearchBox from "@/components/SearchBox";
import StickyCaseBar from "@/components/StickyCaseBar";
import { SECTIONS } from "@/lib/case-sections";
import { buttonClass } from "@/components/ui/button";
import SectionHead from "@/components/ui/SectionHead";
import { parseInput, toChecksum } from "@/lib/address";
import { CATEGORY_SENTENCE, labelStyle } from "@/lib/categories";
import { demoSummaries } from "@/lib/demo-summaries";
import type { DemoCase } from "@/lib/demos";
import { summarizeFlows } from "@/lib/flow-summary";
import { FALLBACK_PRICES, pricesOrFallback, transferValueEth } from "@/lib/flows";
import { formatAmount, formatEthSummary, formatKst } from "@/lib/format";
import { getTag } from "@/lib/labels";
import { findSnapshot, type DemoSnapshot } from "@/lib/snapshots";
import { TRACE_ERRORS, trace, type TraceErrorKind } from "@/lib/trace";
import type { TransferHistory } from "@/lib/transfers";
import type { Prices } from "@/lib/alchemy";
import GraphSection, { GraphIntro, GraphSkeleton } from "./GraphSection";
import PrintButton from "./PrintButton";
import RiskSection, { RiskIntro, RiskSkeleton } from "./RiskSection";
import { TraceBodySkeleton } from "./TraceSkeleton";
import TransferTable, { type TransferRow } from "./TransferTable";

// 표에 보여줄 상대 주소 라벨 (분류 + 이름 + 출처)
function tagOf(address: string | null): TransferRow["tag"] {
  const tag = address ? getTag(address) : null;
  return tag
    ? { category: tag.category, name: tag.name, source: tag.source, updated: tag.updated, community: tag.community }
    : undefined;
}
const RETRYABLE: TraceErrorKind[] = ["rate-limited", "upstream"];
// 입력을 고치면 되는 오류는 중립색, 서버·외부 서비스 문제는 호박색
const INPUT_ERRORS: TraceErrorKind[] = ["format", "checksum", "ens-not-found", "ens-offchain"];

// 오류 화면: 가운데 한 단 + 검색칸 + 데모 바로가기 (막다른 길이 되지 않게)
// heading = 머리말(주소)이 이미 h1이면 h2로
function ErrorCard({
  input,
  error,
  heading: Heading = "h1",
}: {
  input: string;
  error: TraceErrorKind;
  heading?: "h1" | "h2";
}) {
  const isInputError = INPUT_ERRORS.includes(error);
  return (
    <div className="mx-auto max-w-xl pt-10 sm:pt-16">
      {isInputError ? <InfoIcon className="size-5 text-muted" /> : <AlertIcon className="size-5 text-warn" />}
      <Heading className="mt-3 text-3xl font-bold tracking-[-0.025em] text-fg">
        {isInputError ? "주소를 다시 확인해 주세요" : "지금은 송금 기록을 가져올 수 없어요"}
      </Heading>
      <p className="mt-3 text-base text-fg-2">{TRACE_ERRORS[error].message}</p>
      {/* 새로 고침이 필요해서 Link 대신 a */}
      {RETRYABLE.includes(error) && (
        <a href={`/trace/${encodeURIComponent(input)}`} className={buttonClass({ variant: "primary", className: "mt-5" })}>
          <RefreshIcon className="size-4" />
          다시 시도
        </a>
      )}
      <div className="mt-8">
        {/* 주소 모양이 아닌 글자는 그대로 보여주지 않음 (URL에 아무 문장이나 넣어 사칭하는 걸 막으려고) */}
        <SearchBox initialValue={error === "format" ? "" : input.slice(0, 80)} />
      </div>
      <p className="mt-6 text-sm font-semibold text-fg">데모로 둘러보기</p>
      <div className="mt-3">
        <DemoCards summaries={demoSummaries()} compact />
      </div>
    </div>
  );
}

type Saved = { demo: DemoCase; snapshot: DemoSnapshot };

// 데모 저장본 표시 한 줄 (+ 정상 비교 데모는 주소 출처)
function DemoLine({ input, saved }: { input: string; saved: Saved }) {
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-2 print:hidden">
      <span className="inline-flex h-6 items-center rounded-md border border-line-strong bg-surface px-2 text-xs font-medium text-fg-2">
        데모 저장본
      </span>
      <span className="num">{saved.snapshot.capturedAt} 기준 · 미리 저장해 둔 자료라 바로 보여요.</span>
      {saved.demo.kind === "normal" && saved.demo.source && (
        <span>
          {saved.demo.title}은{" "}
          <a
            href={saved.demo.source.url}
            target="_blank"
            rel="noreferrer"
            className="focus-ring rounded-sm underline decoration-line-control decoration-dotted underline-offset-4 transition-colors hover:text-accent"
          >
            {saved.demo.source.name}
            <span className="sr-only"> (새 탭)</span>
          </a>
          에 공개된 주소예요.
        </span>
      )}
      {/* 새 요청이 필요해서 Link 대신 a */}
      <a
        href={`/trace/${encodeURIComponent(input)}?live=1`}
        className="focus-ring rounded-sm font-medium whitespace-nowrap text-fg underline decoration-line-control underline-offset-4 transition-colors hover:text-accent"
      >
        최신 자료로 다시 보기
      </a>
    </p>
  );
}

// 사람이 읽는 이름: 데모 이름 → ENS 이름 → 라벨 이름 → '분류 주소' → '이름 없는 지갑'
function caseName(address: string, ensName: string | null, demo?: DemoCase) {
  if (demo) return demo.title;
  if (ensName) return ensName;
  const tag = getTag(address);
  if (tag?.name) return tag.name;
  if (tag) return `${labelStyle(tag.category).name} 주소`;
  return "이름 없는 지갑";
}

// 사건 머리말: 이름·분류·주소·출처. 주소만 알면 송금 기록 없이 바로 그릴 수 있음
function CaseHeader({
  address: lower,
  ensName,
  demo,
}: {
  address: string;
  ensName: string | null;
  demo?: DemoCase;
}) {
  const address = toChecksum(lower);
  const tag = getTag(lower);
  const name = caseName(lower, ensName, demo);
  return (
    <>
      <header id="case-header" className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">추적한 주소</p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-[-0.025em] text-fg sm:text-4xl">{name}</h1>
          {tag && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <CategoryBadge category={tag.category} />
              <span className="text-[15px] text-fg-2">{CATEGORY_SENTENCE[tag.category]}</span>
            </p>
          )}
          <div className="mt-3.5 flex items-start gap-1 rounded-lg border border-line-strong bg-surface py-1 pr-1 pl-3 sm:inline-flex sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
            {/* 휴대폰은 5묶음씩 두 줄, 넓은 화면은 한 줄 */}
            <Address address={address} variant="lines" className="py-1.5 text-base leading-[26px] text-fg-2 sm:hidden" />
            <Address address={address} className="hidden text-lg text-fg-2 sm:inline" />
            <CopyButton text={address} />
          </div>
          {(tag || ensName) && (
            <p className="mt-1.5 text-xs text-muted">
              {ensName && name !== ensName && (
                <>
                  ENS 이름 <span className="font-medium text-fg-2">{ensName}</span>
                  {tag && " · "}
                </>
              )}
              {tag && (
                <>
                  출처:{" "}
                  <a
                    href={tag.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-ring rounded-sm underline decoration-line-control decoration-dotted underline-offset-4 transition-colors hover:text-accent"
                  >
                    {tag.source}
                    <span className="sr-only"> (새 탭)</span>
                  </a>
                  {tag.updated && <span className="whitespace-nowrap num"> · {tag.updated}</span>}
                  {tag.community && " · 커뮤니티 조사 자료라 틀릴 수 있어요"}
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <PrintButton title={`Omniscient 리포트 ${name}`} />
          <a
            href={`https://etherscan.io/address/${address}`}
            target="_blank"
            rel="noreferrer"
            className={buttonClass({ variant: "secondary" })}
          >
            Etherscan에서 보기
            <ExternalIcon className="size-4 text-muted" />
            <span className="sr-only">(새 탭)</span>
          </a>
        </div>
      </header>

    </>
  );
}

// 요약 숫자 줄 (점수 카드 아래, 패널 없이 선만). ETH만 합친 금액
function Summary({ history }: { history: TransferHistory }) {
  const inCount = history.transfers.filter((t) => t.direction === "in").length;
  const outCount = history.transfers.filter((t) => t.direction === "out").length;
  const counterparties = new Set(
    history.transfers.filter((t) => t.direction !== "self").map((t) => t.counterparty).filter(Boolean),
  ).size;
  const sides = [
    { key: "in", label: "받은 ETH", icon: <ArrowDownLeftIcon className="size-4" />, value: history.ethTotals.in, count: inCount },
    { key: "out", label: "보낸 ETH", icon: <ArrowUpRightIcon className="size-4" />, value: history.ethTotals.out, count: outCount },
  ] as const;

  return (
    <div className="mt-6 flex flex-col gap-3 border-y border-line py-4 break-inside-avoid md:flex-row md:items-center md:justify-between md:gap-10">
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 md:gap-x-10">
      {sides.map(({ key, label, icon, value, count }) => {
        const truncated = history.truncatedBefore[key];
        return (
          <div key={key} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              {icon}
              {label}
            </dt>
            <dd className="mt-1">
              <span className="text-[17px] font-semibold whitespace-nowrap text-fg num sm:text-xl">
                {formatEthSummary(value)}
              </span>
              <span className="ml-1 text-sm text-muted">ETH{truncated ? " 이상" : ""}</span>
              <span className={`block text-xs num ${truncated ? "font-semibold text-warn" : "text-muted"}`}>
                {truncated
                  ? `기록 1,000건 넘음 · 최근 1,000건만`
                  : `${key === "in" ? "받은" : "보낸"} 기록 ${count.toLocaleString("en-US")}건`}
              </span>
            </dd>
          </div>
        );
      })}
      <div className="min-w-0">
        <dt className="text-xs text-muted">거래 상대</dt>
        <dd className="mt-1">
          <span className="text-[17px] font-semibold text-fg num sm:text-xl">{counterparties.toLocaleString("en-US")}</span>
          <span className="ml-1 text-sm text-muted">곳</span>
          <span className="block text-xs text-muted">서로 다른 주소</span>
        </dd>
      </div>
    </dl>
      <p className="text-xs text-muted md:max-w-[34ch] md:text-right">
        ETH만 합친 금액이에요. USDC 같은 토큰은 아래 송금 기록 표에 있어요.
      </p>
    </div>
  );
}

// 이 리포트 목차 + 위에 붙는 띠 (본문이 있을 때만: 조회 오류면 가리킬 단원이 없어서)
function ReportNav({ name, address }: { name: string; address: string }) {
  return (
    <>
      {/* 휴대폰은 위에 붙는 띠가 대신 */}
      <nav
        aria-label="이 리포트"
        className="mt-7 hidden items-center gap-x-6 border-y border-line py-3 text-sm md:flex print:hidden"
      >
        <span className="text-muted">이 리포트</span>
        {SECTIONS.map((section, index) => (
          <a key={section.id} href={`#${section.id}`} className="focus-ring rounded-sm text-fg-2 transition-colors hover:text-fg">
            <span className="mr-1.5 font-mono text-muted num">0{index + 1}</span>
            {section.id === "graph" ? "자금 흐름 그래프" : section.label}
          </a>
        ))}
      </nav>
      <StickyCaseBar name={name} address={address} />
    </>
  );
}

// 머리말 아래: 01 위험 점수 · 02 자금 흐름 그래프 · 03 송금 기록
function TraceBody({
  history,
  saved,
  prices,
  ensName = null,
}: {
  history: TransferHistory;
  saved?: Saved;
  prices: Prices;
  ensName?: string | null;
}) {
  const topFlows = summarizeFlows(history, prices);
  const rows: TransferRow[] = history.transfers.map((t) => ({
    id: t.id,
    hash: t.hash,
    time: formatKst(t.timestamp),
    direction: t.direction,
    counterparty: t.counterparty ? toChecksum(t.counterparty) : null,
    category: t.category,
    amount: formatAmount(t.amount),
    symbol: t.symbol,
    valueEth: transferValueEth(t.symbol, t.amount, prices),
    tag: tagOf(t.counterparty),
  }));

  return (
    <>
      <ReportNav name={caseName(history.address, ensName, saved?.demo)} address={toChecksum(history.address)} />
      {/* 인쇄할 때 제목만 쪽 끝에 남지 않게 제목·내용을 한 쪽에 */}
      <section id="risk" aria-labelledby="risk-title" className="mt-12 scroll-mt-20 print:mt-8">
        <div className="print:break-inside-avoid">
          <RiskIntro titleId="risk-title" />
          <div className="mt-5">
            {/* 점수도 몇 초 걸려서 따로 불러옴 (그래프와 동시에) */}
            <Suspense fallback={<RiskSkeleton />}>
              <RiskSection address={history.address} saved={saved?.snapshot.risk} />
            </Suspense>
          </div>
        </div>
        <Summary history={history} />
      </section>

      <section id="graph" aria-labelledby="graph-title" className="mt-14 scroll-mt-20 print:break-inside-avoid">
        <GraphIntro titleId="graph-title" />
        <div className="mt-5">
          {/* 그래프는 몇 초 걸려서 따로 불러옴 → 위 요약과 아래 표가 먼저 보임 */}
          <Suspense fallback={<GraphSkeleton topFlows={topFlows} />}>
            <GraphSection
              address={history.address}
              saved={saved ? { graph: saved.snapshot.graph, demoId: saved.demo.id } : undefined}
              topFlows={topFlows}
            />
          </Suspense>
        </div>
      </section>

      {/* 인쇄: 송금 기록은 새 쪽에서 (제목만 쪽 끝에 남지 않게) */}
      <section id="transfers" aria-labelledby="transfers-title" className="mt-14 scroll-mt-20 print:mt-0 print:break-before-page">
        <SectionHead number="03" title="송금 기록" titleId="transfers-title">
          블록체인에 남은 송금 기록이에요. 라벨이 있는 상대가 있으면 처음에는 라벨이 있는 상대와 금액이 큰 거래만 보여줘요.
        </SectionHead>
        <div className="mt-5">
          <TransferTable rows={rows} truncated={Boolean(history.truncatedBefore.in || history.truncatedBefore.out)} />
        </div>
      </section>
    </>
  );
}

// 주소를 이미 알 때: 송금 기록만 기다림 (머리말은 먼저 보임)
async function LiveBody({ input }: { input: string }) {
  const [result, { prices }] = await Promise.all([trace(input), pricesOrFallback()]);
  if (!result.ok) return <ErrorCard input={input} error={result.error} heading="h2" />;
  return <TraceBody history={result.history} prices={prices} />;
}

// ENS 이름: 주소로 바꿔야 머리말도 그릴 수 있어서 전부 기다림 (페이지의 TraceSkeleton이 보임)
async function LiveAll({ input }: { input: string }) {
  const [result, { prices }] = await Promise.all([trace(input), pricesOrFallback()]);
  if (!result.ok) return <ErrorCard input={input} error={result.error} />;
  return (
    <>
      <CaseHeader address={result.history.address} ensName={result.ensName} />
      <TraceBody history={result.history} prices={prices} ensName={result.ensName} />
    </>
  );
}

// PDF로 저장했을 때 맨 위에 나오는 머리말 (화면에는 안 보임). 인쇄 시각·주소는 PrintButton이 인쇄 직전에 채움
function PrintHeader({ basis }: { basis: string }) {
  return (
    <div className="mb-2 hidden border-b border-line-strong pb-3 print:block">
      <p className="text-sm font-semibold text-fg">Omniscient · 이더리움 자금 흐름 리포트</p>
      <p className="mt-1 text-xs text-muted">
        자료 기준: {basis} · 인쇄한 시각: <span id="print-stamp" /> · <span id="print-url" />
      </p>
      <p className="mt-1 text-xs text-muted">
        교육·공익 목적의 참고 자료예요. 법적·투자 판단의 근거가 아니며, 주소 라벨은 공개된 제3자 자료라 틀릴 수 있어요.
      </p>
    </div>
  );
}

// 빵부스러기: 처음 › 추적 리포트
export function Breadcrumb() {
  return (
    <nav aria-label="현재 위치" className="text-sm text-muted print:hidden">
      <ol className="flex items-center gap-1">
        <li>
          <Link href="/" className="focus-ring -ml-1 inline-flex h-11 items-center rounded-md px-1 transition-colors hover:text-fg sm:h-auto">
            처음
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRightIcon className="size-3.5" />
        </li>
        <li aria-current="page" className="text-fg-2">
          추적 리포트
        </li>
      </ol>
    </nav>
  );
}

// live = 주소 뒤에 ?live=1을 붙이면 데모 사례도 저장본 대신 실시간으로
export default function TraceResult({ input, live = false }: { input: string; live?: boolean }) {
  // 데모 사례는 저장본으로 바로 (Alchemy 호출 0번). 표의 ETH 환산(정렬용)은 저장할 때의 시세로 (없으면 근사값)
  const saved = live ? null : findSnapshot(input);
  if (saved) {
    return (
      <>
        <PrintHeader basis={`미리 저장해 둔 데모 자료 (${saved.snapshot.capturedAt} 기준)`} />
        <DemoLine input={input} saved={saved} />
        <CaseHeader address={saved.snapshot.history.address} ensName={saved.snapshot.ensName} demo={saved.demo} />
        <TraceBody history={saved.snapshot.history} saved={saved} prices={saved.snapshot.prices ?? FALLBACK_PRICES} />
      </>
    );
  }
  const parsed = parseInput(input);
  if (parsed.kind === "invalid") return <ErrorCard input={input} error={parsed.reason} />;
  const liveHeader = <PrintHeader basis="블록체인에서 실시간으로 조회한 자료" />;
  if (parsed.kind === "ens") {
    return (
      <>
        {liveHeader}
        <LiveAll input={input} />
      </>
    );
  }
  // 0x 주소는 머리말(주소·라벨)을 먼저 보여주고 나머지만 기다림 → 로딩 화면과 결과의 머리말 높이가 같음
  return (
    <>
      {liveHeader}
      <CaseHeader address={parsed.address} ensName={null} />
      <Suspense fallback={<TraceBodySkeleton />}>
        <LiveBody input={input} />
      </Suspense>
    </>
  );
}
