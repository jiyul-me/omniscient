import type { ReactNode } from "react";
import CategoryMark from "@/components/CategoryMark";
import { ScoreBeacon } from "@/components/caseScore";
import GradeChip from "@/components/GradeChip";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ChevronRightIcon,
  InfoIcon,
  LockIcon,
} from "@/components/icons";
import Callout from "@/components/ui/Callout";
import Notes, { type Note } from "@/components/ui/Notes";
import { labelStyle, type LabelCategory } from "@/lib/categories";
import type { RiskReport } from "@/lib/exposure";
import { formatEth, formatPercent } from "@/lib/format";
import type { ExposureReason, RiskReason } from "@/lib/risk";
import { RISK } from "@/lib/risk-config";

// 위험 점수 카드 (계산법은 README '위험 점수'와 사이트 /sources). 큰 점수 + 4칸 눈금 막대(50점 이상만 호박색) + 점수 계산 한 줄
// + 받은 돈·보낸 돈 점수와 확인한 돈 + 경고 상자 + 이유 두 묶음(최소 점수 규칙 / 노출 점수)
// 분류 6색(빨강·초록 등)은 주소 점 전용이라 점수엔 안 씀

const SIDE_WORD = { in: "받은 돈", out: "보낸 돈" } as const;
const SHOWN = 5; // 처음부터 보여줄 이유 수 (나머지는 '더 보기')
const TOP_GRADE = RISK.grades[0].min; // '매우 높음'이 시작하는 점수

// 막대 칸: 낮은 등급부터, 칸 너비 = 점수 범위 (0~19 / 20~49 / 50~79 / 80~100)
const BANDS = [...RISK.grades].reverse().map((grade, i, list) => ({
  ...grade,
  width: (list[i + 1]?.min ?? 100) - grade.min,
}));

function describe(reason: RiskReason): { category: LabelCategory; title: string; detail: string } {
  if (reason.kind === "self") {
    return {
      category: reason.category,
      title: `이 주소 자체가 ${labelStyle(reason.category).name} 라벨`,
      detail: `이 주소 자체 · 출처: ${reason.source}${reason.community ? " (커뮤니티 조사 자료라 틀릴 수 있어요)" : ""}`,
    };
  }
  if (reason.kind === "sent-sanctioned") {
    return {
      category: "sanctioned",
      title: "제재 주소로 직접 돈을 보냄",
      detail: `1단계 · ${formatEth(reason.valueEth)} 상당 · 금액과 상관없이 적용`,
    };
  }
  const { side, hop, category, share, valueEth, points, added } = reason;
  const via = hop === 1 ? "1단계 (직접 주고받음)" : `${hop}단계 연결 (한 곳 거쳐서)`;
  return {
    category,
    title: `${labelStyle(category).name} · ${SIDE_WORD[side]}의 ${formatPercent(share)}`,
    detail: `${via} · ${formatEth(valueEth)} 상당${points !== added ? ` · 이것만 있으면 ${points}점` : ""}`,
  };
}

function ReasonItem({ reason, number, same }: { reason: RiskReason; number: number; same?: number }) {
  const { category, title, detail } = describe(reason);
  const floor = reason.kind !== "exposure";
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        aria-hidden="true"
        className="mt-px flex size-[22px] shrink-0 items-center justify-center rounded-full border border-line-control text-xs text-fg-2 num"
      >
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[15px] font-medium text-fg">
          <CategoryMark category={category} />
          {title}
        </p>
        <p className="mt-0.5 text-xs text-muted num">
          {detail}
          {same !== undefined && ` · ${same}번과 같은 송금`}
        </p>
        {reason.kind === "exposure" && (
          <div aria-hidden="true" className="mt-2 h-1.5 w-full max-w-60 rounded-full bg-surface-2 forced-colors:border forced-colors:border-[CanvasText]">
            <div
              className="h-full rounded-full bg-fg-2 forced-colors:bg-[CanvasText]"
              style={{ width: `${Math.max(2, Math.min(100, reason.share * 100))}%` }}
            />
          </div>
        )}
      </div>
      {floor ? (
        <span className="shrink-0 rounded-md border border-fg px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap text-fg num">
          최소 {reason.points}점
        </span>
      ) : (
        <span className="shrink-0 text-[15px] font-strong whitespace-nowrap text-fg num">
          +{(reason as ExposureReason).added}점
        </span>
      )}
    </li>
  );
}

function GroupHead({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-line pt-3 pb-2 text-xs">
      {icon}
      <span className="font-semibold text-fg">{title}</span>
      {children && <span className="text-muted num">{children}</span>}
    </p>
  );
}

// beacon = 위에 붙는 띠에 점수를 알릴지 (로딩 화면의 보이지 않는 자리표시 카드는 false)
export default function RiskCard({ report, beacon = true }: { report: RiskReport; beacon?: boolean }) {
  const { score, gradeName, sides, reasons, victim, truncated, approx, failed, estimated, grouped, sampled } =
    report;
  const warn = score >= RISK.warnFrom;
  // 점수에 1점도 안 보탠 아주 작은 노출은 목록에서 뺌 (개수만 알려 줌)
  const shown = reasons.filter((r) => r.kind !== "exposure" || r.points > 0 || r.added > 0);
  const tiny = reasons.length - shown.length;
  const floors = shown.filter((r) => r.kind !== "exposure");
  const exposures = shown.filter((r): r is ExposureReason => r.kind === "exposure");

  // 점수 계산 한 줄: 대표 점수 = max(받은 돈, 보낸 돈, 최소 점수)
  const bigger = Math.max(sides.in.score, sides.out.score);
  const self = floors.find((r) => r.kind === "self");
  const floored = floors.length > 0 && score > bigger;
  const rule =
    self && self.kind === "self" ? `이 주소가 ${labelStyle(self.category).name} 라벨이라` : "제재 주소로 직접 돈을 보내서";

  // 노출 점수 식: '보낸 돈 81점 = 75 + 6 · 받은 돈 4점'
  const formula = (["out", "in"] as const)
    .filter((side) => sides[side].score > 0 || exposures.some((r) => r.side === side))
    .map((side) => {
      const parts = exposures.filter((r) => r.side === side).map((r) => r.added);
      const sum = parts.reduce((total, n) => total + n, 0);
      const terms = parts.length > 1 ? ` = ${parts.join(" + ")}${sum !== sides[side].score ? " + …" : ""}` : "";
      return `${SIDE_WORD[side]} ${sides[side].score}점${terms}`;
    })
    .join(" · ");

  // 번호: 최소 점수 규칙 → 노출 점수 순서. 제재 송금 이유와 같은 돈을 다루는 노출 이유가 있으면 'n번과 같은 송금'
  const ordered = [...floors, ...exposures];
  const sameAs = (reason: RiskReason) => {
    if (reason.kind !== "sent-sanctioned") return undefined;
    const index = ordered.findIndex(
      (r) =>
        r.kind === "exposure" &&
        r.side === "out" &&
        r.hop === 1 &&
        r.category === "sanctioned" &&
        Math.abs(r.valueEth - reason.valueEth) <= 1,
    );
    return index === -1 ? undefined : index + 1;
  };
  const visible = ordered.slice(0, SHOWN);
  const folded = ordered.slice(SHOWN);

  // 경고 상자: 이 결과에만 해당하는 사실. 확인한 돈 경고는 결론이 바뀔 수 있을 때만 (이미 '매우 높음'이면 안 띄움)
  const warnings: { title: string; body: string }[] = [];
  for (const side of ["in", "out"] as const) {
    if (!truncated[side]) continue;
    warnings.push({
      title: `${side === "in" ? "받은" : "보낸"} 기록이 1,000건이 넘어서 최근 1,000건만 점수에 썼어요`,
      body: "그 전 거래가 빠져서 실제와 다르게 (높거나 낮게) 나올 수 있어요.",
    });
  }
  const lowCoverage = (side: "in" | "out") =>
    sides[side].totalEth > 0 && sides[side].coverage < 0.5 && score < TOP_GRADE;
  for (const side of ["in", "out"] as const) {
    if (!lowCoverage(side)) continue;
    warnings.push({
      title: `${SIDE_WORD[side]}은 ${formatPercent(sides[side].coverage)}만 확인했어요`,
      body: `나머지는 라벨이 없는 주소와 오간 돈이라 점수에 영향이 없어요. ${SIDE_WORD[side]} 점수(${sides[side].score}점)는 실제보다 낮을 수 있어요.`,
    });
  }
  if (failed > 0) {
    warnings.push({ title: `주소 ${failed}곳은 한 단계 더 따라가지 못했어요`, body: "그만큼 점수에서 빠졌어요." });
  }

  const notes: Note[] = [];
  if (victim) notes.push({ lead: "피해 지갑", text: "해킹 피해 지갑이라 해커에게 보낸 돈(털린 돈)은 점수에서 뺐어요." });
  if (estimated > 0) {
    notes.push({
      lead: "비슷한 금액 묶음",
      text: `비슷한 금액으로 나뉜 상대 ${grouped}곳은 그중 ${sampled}곳만 한 단계 더 따라가 보고, 나머지 ${estimated}곳도 같은 비율이라고 봤어요.`,
    });
  }
  if (approx) notes.push({ lead: "시세", text: "토큰 시세를 가져오지 못해서 근사값으로 금액을 비교했어요." });

  return (
    <div className="rounded-xl border border-line-strong bg-surface break-inside-avoid">
      {beacon && <ScoreBeacon score={score} gradeName={gradeName} />}
      <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:divide-x md:divide-line print:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] print:divide-x print:divide-line">
        <div className="p-4 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <p className="flex items-baseline gap-2">
              <span className="text-[64px] leading-[62px] font-bold tracking-[-0.04em] text-fg num sm:text-score sm:leading-[76px] print:text-[56px] print:leading-[56px]">
                {score}
              </span>
              <span className="text-[15px] whitespace-nowrap text-muted">/ 100점</span>
            </p>
            <GradeChip score={score} gradeName={gradeName} size="lg" />
          </div>

          <div className="mt-6">
            <div
              role="meter"
              aria-label="위험 점수"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={score}
              aria-valuetext={`100점 중 ${score}점, ${gradeName}`}
              className="flex gap-[3px]"
            >
              {BANDS.map((band) => {
                const fill = Math.max(0, Math.min(1, (score - band.min) / band.width));
                return (
                  <div
                    key={band.key}
                    className="h-3 overflow-hidden rounded-[3px] border border-line-control bg-surface forced-colors:border-[CanvasText]"
                    style={{ width: `${band.width}%` }}
                  >
                    <div
                      className={`h-full ${warn ? "bg-warn-fill" : "bg-fg-2"} forced-colors:bg-[CanvasText]`}
                      style={{ width: `${fill * 100}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <ol aria-hidden="true" className="mt-2 flex text-xs text-muted">
              {BANDS.map((band) => (
                <li
                  key={band.key}
                  className={band.name === gradeName ? "font-semibold text-fg" : ""}
                  style={{ width: `${band.width}%` }}
                >
                  {band.name}
                </li>
              ))}
            </ol>
          </div>

          <p className="mt-5 flex gap-2.5 rounded-lg bg-surface-2 px-3.5 py-3 text-sm text-fg-2 num forced-colors:border forced-colors:border-[CanvasText]">
            {floored ? <LockIcon className="mt-[3px] size-4 text-muted" /> : <InfoIcon className="mt-[3px] size-4 text-muted" />}
            <span>
              받은 돈 {sides.in.score}점, 보낸 돈 {sides.out.score}점 중{" "}
              {floored ? (
                <>
                  큰 쪽은 {bigger}점이지만, {rule} <strong className="font-semibold text-fg">최소 {score}점</strong>이
                  적용됐어요.
                </>
              ) : (
                "큰 쪽을 점수로 써요."
              )}
            </span>
          </p>

          <dl className="mt-4 grid grid-cols-2 divide-x divide-line rounded-lg border border-line-strong">
            {(["in", "out"] as const).map((side) => {
              const low = lowCoverage(side);
              return (
                <div key={side} className="px-3.5 py-3">
                  <dt className="flex items-center gap-1.5 text-xs text-muted">
                    {side === "in" ? <ArrowDownLeftIcon className="size-3.5" /> : <ArrowUpRightIcon className="size-3.5" />}
                    {SIDE_WORD[side]} 점수
                  </dt>
                  <dd className="mt-1">
                    <span className="text-2xl font-strong tracking-[-0.02em] text-fg num sm:text-[28px] sm:leading-[34px]">
                      {sides[side].score}
                    </span>
                    <span className="ml-1 text-sm text-muted">점</span>
                    {sides[side].totalEth > 0 ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="mt-2 block h-1.5 overflow-hidden rounded-full border border-line-control bg-surface forced-colors:border-[CanvasText]"
                        >
                          <span
                            className="block h-full bg-fg-2 forced-colors:bg-[CanvasText]"
                            style={{ width: `${Math.min(100, sides[side].coverage * 100)}%` }}
                          />
                        </span>
                        <span className={`mt-1 flex items-center gap-1 text-xs num ${low ? "font-semibold text-warn" : "text-fg-2"}`}>
                          확인한 돈 {formatPercent(sides[side].coverage)}
                        </span>
                      </>
                    ) : (
                      <span className="mt-1 block text-xs text-muted">오간 돈 없음</span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>

          {warnings.length > 0 && (
            <Callout tone="warn" className="mt-4" title={warnings.length === 1 ? warnings[0].title : undefined}>
              {warnings.length === 1 ? (
                warnings[0].body
              ) : (
                <ul className="space-y-2">
                  {warnings.map((warning) => (
                    <li key={warning.title}>
                      <p className="font-semibold">{warning.title}</p>
                      <p>{warning.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Callout>
          )}
        </div>

        <div className="min-w-0 border-t border-line p-4 sm:p-7 md:border-t-0 print:border-t-0">
          <h3 className="flex items-baseline gap-2 text-lg font-strong text-fg">
            점수 이유
            {shown.length > 0 && <span className="text-xs font-normal text-muted">{shown.length}개 · 영향이 큰 순서</span>}
          </h3>
          {shown.length === 0 ? (
            <p className="mt-3 text-sm text-fg-2">
              {tiny > 0
                ? "점수에 들어가는 주소(제재·해커·믹서·브릿지)와 오간 돈이 조금 있지만, 비율이 아주 작아서 점수에 영향이 없어요."
                : "점수에 들어가는 주소(제재·해커·믹서·브릿지)와 직접 또는 한 단계 건너 오간 돈을 찾지 못했어요."}
            </p>
          ) : (
            <>
              {floors.length > 0 && (
                <>
                  <GroupHead icon={<LockIcon className="size-3.5 text-muted" />} title="최소 점수 규칙">
                    하나라도 맞으면 점수가 이 아래로 내려가지 않아요
                  </GroupHead>
                  <ol className="divide-y divide-line">
                    {visible
                      .filter((r) => r.kind !== "exposure")
                      .map((reason) => (
                        <ReasonItem key={ordered.indexOf(reason)} reason={reason} number={ordered.indexOf(reason) + 1} same={sameAs(reason)} />
                      ))}
                  </ol>
                </>
              )}
              {exposures.length > 0 && (
                <>
                  <GroupHead title="노출 점수">{formula}</GroupHead>
                  <ol className="divide-y divide-line">
                    {visible
                      .filter((r) => r.kind === "exposure")
                      .map((reason) => (
                        <ReasonItem key={ordered.indexOf(reason)} reason={reason} number={ordered.indexOf(reason) + 1} />
                      ))}
                  </ol>
                </>
              )}
              {folded.length > 0 && (
                <details className="group border-t border-line">
                  {/* 브라우저 기본 ▶ 표시는 숨기고 icons.tsx 아이콘으로 */}
                  <summary className="focus-ring-inset flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md text-sm font-medium text-fg-2 transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
                    <ChevronRightIcon className="size-4 group-open:rotate-90 motion-safe:transition-transform" />
                    이유 {folded.length}개 더 보기
                  </summary>
                  <ol className="divide-y divide-line border-t border-line">
                    {folded.map((reason) => (
                      <ReasonItem key={ordered.indexOf(reason)} reason={reason} number={ordered.indexOf(reason) + 1} same={sameAs(reason)} />
                    ))}
                  </ol>
                </details>
              )}
            </>
          )}
          {tiny > 0 && shown.length > 0 && (
            <p className="mt-2 text-xs text-muted">점수에 1점도 안 되는 아주 작은 연결 {tiny}개는 뺐어요.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 border-t border-line px-4 py-4 text-sm sm:px-7 md:grid-cols-2 md:gap-8">
        <details className="group">
          <summary className="focus-ring flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm font-semibold text-fg [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-4 text-muted group-open:rotate-90 motion-safe:transition-transform" />
            확인한 돈이란?
          </summary>
          <p className="mt-2 max-w-[62ch] text-fg-2">
            라벨이 있는 주소와 오간 돈 + 한 단계 더 따라가 본(또는 같은 비율이라고 본) 주소와 오간 돈의 비율이에요.
            나머지는 라벨이 없어서 점수에 영향이 없어요.
          </p>
        </details>
        <Notes
          notes={[{ text: "자동 점수는 참고용이에요. 라벨이 틀릴 수 있고, 라벨에 없는 위험 주소는 잡지 못해요." }, ...notes]}
        />
      </div>
    </div>
  );
}
