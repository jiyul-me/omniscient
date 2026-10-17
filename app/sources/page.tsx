import type { Metadata } from "next";
import type { ReactNode } from "react";
import CategoryMark from "@/components/CategoryMark";
import { ChevronRightIcon, ExternalIcon, LockIcon } from "@/components/icons";
import PageToc from "@/components/PageToc";
import SectionHead from "@/components/ui/SectionHead";
import { labelStyle, legendName, type LabelCategory } from "@/lib/categories";
import { DEMO_CASES } from "@/lib/demos";
import { labelSources } from "@/lib/labels";
import type { ExposureReason } from "@/lib/risk";
import { DUST_ETH, RISK } from "@/lib/risk-config";
import { loadSnapshot } from "@/lib/snapshots";
import { TOKENS } from "@/lib/tokens";

export const metadata: Metadata = {
  title: "자료 출처와 계산법",
  description: "Omniscient가 쓰는 공개 자료(송금 기록·주소 라벨)의 출처와 위험 점수 계산법",
};

const LINK =
  "focus-ring rounded-sm underline decoration-line-control decoration-dotted underline-offset-4 transition-colors hover:text-accent";

// 라벨 우선순위 순서 (lib/categories.ts·scripts/build-labels.mts와 같음)
const CATEGORY_ORDER: LabelCategory[] = ["sanctioned", "hacker", "mixer", "victim", "bridge", "exchange", "dex"];

const SECTIONS = [
  { id: "score", label: "위험 점수 계산법" },
  { id: "limits", label: "한계" },
  { id: "labels", label: "주소 라벨 출처" },
  { id: "transfers", label: "송금 기록" },
  { id: "disclaimer", label: "면책" },
] as const;

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`${LINK} inline-flex items-center gap-1`}>
      {children}
      <ExternalIcon className="size-3.5 text-muted" />
      <span className="sr-only">(새 탭)</span>
    </a>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-14 scroll-mt-8">
      <SectionHead title={title} titleId={`${id}-title`} />
      <div className="mt-5 space-y-4 text-base leading-[30px] text-fg-2">{children}</div>
    </section>
  );
}

// Ronin 데모 저장본으로 만든 계산 예시: 보낸 돈 = 제재 75 + 해커 6 = 81점 → 최소 90점
function Example() {
  const demo = DEMO_CASES.find((d) => d.id === "ronin");
  const risk = demo ? loadSnapshot(demo.id)?.risk : null;
  if (!demo || !risk) return null;
  const out = risk.reasons.filter((r): r is ExposureReason => r.kind === "exposure" && r.side === "out" && r.added > 0);
  const floor = risk.reasons.find((r) => r.kind === "self");
  return (
    <div className="rounded-xl border border-line-strong bg-surface p-5 text-sm leading-6">
      <p className="text-xs font-semibold text-muted">계산 예시 · {demo.title} 데모</p>
      <p className="mt-2 text-fg num">
        보낸 돈 ={" "}
        {out.map((r, i) => (
          <span key={i}>
            {i > 0 && " + "}
            {labelStyle(r.category).name} {r.added}
          </span>
        ))}{" "}
        = <strong className="font-semibold">{risk.sides.out.score}점</strong>
      </p>
      <p className="mt-1 text-fg num">받은 돈 = {risk.sides.in.score}점</p>
      {floor && floor.kind === "self" && (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-fg-2">
          <LockIcon className="mt-1 size-4 text-muted" />
          <span>
            큰 쪽은 {Math.max(risk.sides.in.score, risk.sides.out.score)}점이지만, 이 주소가{" "}
            {labelStyle(floor.category).name} 라벨이라 <strong className="font-semibold text-fg">최소 {risk.score}점</strong>
            이 적용돼요.
          </span>
        </p>
      )}
    </div>
  );
}

export default function SourcesPage() {
  const { generatedAt, total, sources } = labelSources();
  const symbols = ["ETH", ...Object.values(TOKENS).map((token) => token.symbol)];
  const normal = DEMO_CASES.find((demo) => demo.kind === "normal");
  const weights = CATEGORY_ORDER.filter((category) => category !== "dex").map((category) => ({
    category,
    name: category === "exchange" ? legendName("exchange") : labelStyle(category).name,
    weight: RISK.weights[category],
  }));
  const grades = [...RISK.grades]
    .reverse()
    .map((grade, i, list) => `${grade.name} ${grade.min}~${(list[i + 1]?.min ?? 101) - 1}점`)
    .join(" · ");

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6 sm:pt-14 lg:grid lg:grid-cols-[minmax(0,720px)_220px] lg:gap-16">
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted">자료 출처·계산법</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.025em] text-fg sm:text-4xl">자료 출처와 계산법</h1>
        <ul className="mt-6 space-y-2 rounded-xl border border-line-strong bg-surface p-5 text-[15px] leading-[26px] text-fg-2">
          <li>
            <strong className="font-semibold text-fg">무엇을 재나요</strong> — 제재·해커·믹서 주소와 얼마나 얽혔는지를 0~100점으로
            매겨요.
          </li>
          <li>
            <strong className="font-semibold text-fg">라벨</strong> — 다시 쓰는 게 허용된 공개 자료로 주소{" "}
            <span className="num">{total.toLocaleString("en-US")}</span>개에 이름표를 붙였어요.
          </li>
          <li>
            <strong className="font-semibold text-fg">가장 큰 한계</strong> — 라벨에 없는 위험 주소는 잡지 못하고, 거래가
            1,000건 넘는 주소는 최근 기록만 봐요.
          </li>
        </ul>

        {/* 휴대폰·태블릿: 목차를 맨 위에 접어서 */}
        <details className="group mt-6 rounded-xl border border-line-strong bg-surface lg:hidden">
          <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 text-sm font-semibold text-fg [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-4 text-muted group-open:rotate-90 motion-safe:transition-transform" />이 페이지
          </summary>
          <ul className="border-t border-line px-4 py-2">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="focus-ring block rounded-sm py-2 text-sm text-fg-2 hover:text-fg">
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </details>

        <Section id="score" title="위험 점수 계산법">
          <p>
            나쁜 주소와 얽힌 정도를 <strong className="font-semibold text-fg">기여도 = 얼마나 나쁜 곳인지 × 몇 단계 건너인지 × 돈의 몇 %인지</strong>로
            계산하고, 기여도가 여러 개면 아래처럼 합쳐서 100을 곱하고 반올림해요. 그래서 아무리 많이 더해도 100점을 넘지
            않아요.
          </p>
          <div className="overflow-x-auto rounded-xl border border-line-strong bg-surface px-5 py-4">
            <p className="font-mono text-[15px] leading-[26px] whitespace-nowrap text-fg">
              위험 = 1 − (1 − 기여도₁) × (1 − 기여도₂) × …
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <table className="w-full overflow-hidden rounded-xl border border-line-strong bg-surface text-sm leading-6 num">
              <caption className="sr-only">얼마나 나쁜 곳인지 (무게)</caption>
              <thead className="bg-surface-2">
                <tr className="border-b border-line-strong text-left text-xs text-muted">
                  <th scope="col" className="px-4 py-2 font-semibold">상대 주소</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">무게</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {weights.map(({ category, name, weight }) => (
                  <tr key={category}>
                    <td className="px-4 py-2 text-fg">
                      <span className="inline-flex items-center gap-2">
                        <CategoryMark category={category} />
                        {name}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-fg">{weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="h-fit w-full overflow-hidden rounded-xl border border-line-strong bg-surface text-sm leading-6 num">
              <caption className="sr-only">몇 단계 건너인지 (할인)</caption>
              <thead className="bg-surface-2">
                <tr className="border-b border-line-strong text-left text-xs text-muted">
                  <th scope="col" className="px-4 py-2 font-semibold">거리</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">곱하는 값</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[1, 2].map((hop) => (
                  <tr key={hop}>
                    <td className="px-4 py-2 text-fg">{hop === 1 ? "1단계 (직접 주고받음)" : "2단계 (한 곳 거쳐서)"}</td>
                    <td className="px-4 py-2 text-right text-fg">{RISK.hopDiscount[hop]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="list-disc space-y-2 pl-5 marker:text-muted">
            <li>받은 돈과 보낸 돈을 따로 계산하고, 더 큰 쪽을 대표 점수로 보여줘요.</li>
            <li>
              <strong className="font-semibold text-fg">최소 점수 규칙</strong>: 주소 자체가 제재·해커 라벨이거나 제재 주소로
              직접 돈을 보냈으면 금액과 상관없이 최소 {RISK.floor}점이에요.
            </li>
            <li>
              누구나 아무 주소에 소액을 보낼 수 있어서, 받은 돈 중 {DUST_ETH} ETH 미만(먼지)은 무시해요. 보낸 돈은 작아도
              셈해요.
            </li>
            <li>해킹 피해 지갑은 해커에게 보낸 돈(털린 돈)을 점수에서 빼요.</li>
            <li>
              같은 돈을 지갑 여러 개로 쪼개도 점수가 같도록, 상대 지갑마다가 아니라 (받은/보낸, 분류, 단계) 묶음마다 금액을
              먼저 더해서 계산해요.
            </li>
            <li>
              2단계는 라벨 없는 상대 중 금액이 큰 {RISK.lookThroughPerSide}곳(비슷한 금액으로 나뉜 곳은 한 묶음)만 한 번 더
              따라가 봐요. 받은 쪽은 그 상대가 우리에게 보내기 전에 받은 돈, 보낸 쪽은 우리에게 받은 뒤에 보낸 돈만 봐요.
            </li>
            <li className="num">등급: {grades}</li>
          </ul>
          <Example />
          <p>
            업계에서 공개한 개념(직접·간접 노출, 단계, 금액 비중, 4단계 등급)을 참고해 단순하게 만든 모델이에요. 실제 업계
            도구의 계산식은 공개돼 있지 않아요.
          </p>
        </Section>

        <Section id="limits" title="한계">
          <ul className="list-disc space-y-2 pl-5 marker:text-muted">
            <li>라벨에 없는 위험 주소는 잡지 못하고, 라벨이 틀릴 수도 있어요.</li>
            <li>거래가 1,000건 넘는 주소는 최근 기록만 봐서 점수가 실제와 다를 수 있어요 (화면에 경고가 떠요).</li>
            <li>다른 블록체인으로 넘어간 돈은 따라가지 못해요. 이더리움 메인넷만 봐요.</li>
            <li>3단계 이상 떨어진 연결은 점수에 넣지 않아요.</li>
            <li>자동 점수는 참고용이에요. 최종 판단은 사람이 해야 해요.</li>
          </ul>
        </Section>

        <Section id="labels" title="주소 라벨 출처">
          <p>
            공개 자료 {sources.length}개에서 주소 <span className="num">{total.toLocaleString("en-US")}</span>개에 라벨을
            붙였어요 (<span className="num">{generatedAt}</span>에 만듦). 다시 쓰는 게 허용된 자료만 써요. Etherscan 이름표는
            약관에서 복제를 금지해서 쓰지 않아요.
          </p>
          {/* 넓은 화면은 표, 휴대폰은 카드 목록 */}
          <div className="hidden overflow-hidden rounded-xl border border-line-strong bg-surface sm:block">
            <table className="w-full text-sm leading-6">
              <thead className="bg-surface-2">
                <tr className="border-b border-line-strong text-left text-xs text-muted">
                  <th scope="col" className="px-4 py-2 font-semibold">자료</th>
                  <th scope="col" className="px-4 py-2 font-semibold">분류·개수</th>
                  <th scope="col" className="px-4 py-2 font-semibold whitespace-nowrap">날짜</th>
                  <th scope="col" className="px-4 py-2 font-semibold">라이선스</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sources.map((source) => (
                  <tr key={source.id} className="align-top">
                    <td className="px-4 py-3 text-fg">
                      <External href={source.url}>{source.name}</External>
                      {source.community && (
                        <span className="mt-1 ml-1 inline-flex h-6 items-center rounded-md border border-line-strong px-1.5 text-xs font-medium text-fg-2">
                          커뮤니티 조사
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex flex-col gap-1 text-xs text-fg-2 num">
                        {CATEGORY_ORDER.filter((category) => source.counts[category]).map((category) => (
                          <span key={category} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <CategoryMark category={category} />
                            {labelStyle(category).name} {source.counts[category]}개
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap text-muted num">{source.updated || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted">{source.license?.replace(/^라이선스\s*/, "") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 sm:hidden">
            {sources.map((source) => (
              <li key={source.id} className="rounded-xl border border-line-strong bg-surface p-4 text-sm leading-6">
                <p className="text-fg">
                  <External href={source.url}>{source.name}</External>
                </p>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-2 num">
                  {CATEGORY_ORDER.filter((category) => source.counts[category]).map((category) => (
                    <span key={category} className="inline-flex items-center gap-1.5">
                      <CategoryMark category={category} />
                      {labelStyle(category).name} {source.counts[category]}개
                    </span>
                  ))}
                </p>
                <p className="mt-1 text-xs text-muted num">
                  {[source.updated && `날짜 ${source.updated}`, source.license && source.license.replace(/^라이선스\s*/, ""), source.community && "커뮤니티 조사"]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
          <p>
            한 주소에 라벨이 여러 개면 제재 &gt; 해커 &gt; 믹서 &gt; 해킹 피해 &gt; 브릿지 &gt; 거래소 &gt; DEX 순으로 하나만
            보여줘요. 커뮤니티 조사 자료는 공식 자료에 라벨이 없을 때만 써요. Tornado Cash는 2025-03-21 미국 제재가 풀려서
            빨강 네모(제재)가 아니라 보라 세모(믹서)로 그려요.
          </p>
          {normal?.source && (
            <p>
              정상 비교 데모({normal.title}, {normal.ens}) 주소는 <External href={normal.source.url}>{normal.source.name}</External>에
              공개된 주소예요.
            </p>
          )}
        </Section>

        <Section id="transfers" title="송금 기록">
          <p>
            이더리움 메인넷 공개 데이터를{" "}
            <External href="https://www.alchemy.com/docs/data/transfers-api/transfers-endpoints/alchemy-get-asset-transfers">
              Alchemy Transfers API
            </External>
            로 가져와요. 주소마다 받은 기록과 보낸 기록을 최신순으로 1,000건씩 봐요.
          </p>
          <p>
            이름만 같은 가짜 토큰이 많아서, 컨트랙트 주소로 확인된 {symbols.join(", ")}만 써요. 토큰 금액은 비교할 때만
            Alchemy 시세로 ETH 값으로 바꿔요.
          </p>
          <p>
            첫 화면의 데모 {DEMO_CASES.length}개는 발표 중에도 바로 보이게 미리 받아 둔 저장본을 보여줘요. 결과 화면 위
            안내에서 최신 자료로 다시 볼 수 있어요.
          </p>
        </Section>

        <Section id="disclaimer" title="면책">
          <p>
            <strong className="font-semibold text-fg">교육·공익 목적</strong>의 비상업 데모 프로젝트예요. 법적·투자 판단의
            근거가 아니에요. 데모 사례는 공공기관(FBI·미국 재무부·한국 경찰)이 공개한 해킹 사건의 주소와, 단체가 공개한
            지갑만 써요.
          </p>
        </Section>
      </div>
      <aside className="hidden lg:block">
        <PageToc items={SECTIONS} />
      </aside>
    </div>
  );
}
