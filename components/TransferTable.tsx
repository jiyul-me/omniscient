"use client";

import CategoryMark from "@/components/CategoryMark";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Address from "@/components/Address";
import {
  AlertIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ExternalIcon,
  RefreshIcon,
  SortIcon,
} from "@/components/icons";
import { useMedia } from "@/components/graph/useMedia";
import { buttonClass } from "@/components/ui/button";
import Notes, { type Note } from "@/components/ui/Notes";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { labelStyle, type LabelCategory } from "@/lib/categories";
import { shortAddress } from "@/lib/format";
import { DUST_ETH } from "@/lib/risk-config";
import { TOKENS } from "@/lib/tokens";

// 서버에서 화면용 글자로 미리 바꿔서 넘김 (체크섬 주소, 한국 시간, 금액)
export type TransferRow = {
  id: string;
  hash: string;
  time: string;
  direction: "in" | "out" | "self";
  counterparty: string | null; // 체크섬. null = 컨트랙트 생성
  category: "external" | "internal" | "erc20";
  amount: string;
  symbol: string;
  valueEth: number; // ETH 환산값 (주요 거래 고르기·금액순 정렬·받은 먼지 거르기용, 화면엔 안 보임)
  // data/labels.json 라벨 (출처·날짜는 라벨 열에 늘 보임)
  tag?: { category: LabelCategory; name: string; source: string; updated: string; community: boolean };
};

type View = "major" | "all";
type Direction = "all" | "in" | "out";
type Sort = "amount" | "recent";

const KNOWN_SYMBOLS = ["ETH", ...Object.values(TOKENS).map((t) => t.symbol)];
// 주요 거래 = 라벨 있는 상대와의 송금 + 금액 큰 순 이만큼 (받은 먼지 제외)
const TOP_BY_VALUE = 10;

// 방향은 색 대신 아이콘 + 밝기로 (초록은 거래소 색, 청록은 버튼·링크 색이라 안 씀)
const DIRECTION = {
  in: { label: "받음", className: "text-fg-2" },
  out: { label: "보냄", className: "font-medium text-fg" },
  self: { label: "자기 자신", className: "text-fg-2" },
};

const CATEGORY_LABEL = {
  external: { text: "일반", title: "지갑이 직접 보낸 ETH 송금" },
  internal: { text: "내부", title: "컨트랙트(자동 프로그램)가 보낸 ETH 송금" },
  erc20: { text: "토큰", title: "ERC-20 토큰 송금" },
};

// 앞 4글자·뒤 4글자가 같은데 실제로는 다른 주소 = 주소 오염 공격에 쓰이는 '닮은 주소'
function findLookalikes(rows: TransferRow[]) {
  const groups = new Map<string, Set<string>>();
  for (const { counterparty } of rows) {
    if (!counterparty) continue;
    const key = shortAddress(counterparty).toLowerCase();
    groups.set(key, (groups.get(key) ?? new Set()).add(counterparty));
  }
  const lookalikes = new Set<string>();
  for (const group of groups.values()) {
    if (group.size > 1) group.forEach((address) => lookalikes.add(address));
  }
  return lookalikes;
}

function DirectionIcon({ direction }: { direction: TransferRow["direction"] }) {
  if (direction === "in") return <ArrowDownLeftIcon className="size-4" />;
  if (direction === "out") return <ArrowUpRightIcon className="size-4" />;
  return <RefreshIcon className="size-4" />;
}

// "109,270.16" → ["109,270", ".16"]: 소수점 위치를 세로로 맞추려고 나눔 ("<0.000001" → "<0", ".000001")
function splitAmount(amount: string): [string, string] {
  const dot = amount.indexOf(".");
  return dot === -1 ? [amount, ""] : [amount.slice(0, dot), amount.slice(dot)];
}

function TxLink({ hash }: { hash: string }) {
  return (
    <a
      href={`https://etherscan.io/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Etherscan에서 거래 상세 보기 (새 탭)"
      title="Etherscan에서 거래 상세 보기"
      className={buttonClass({ variant: "ghost", size: "sm", icon: true, className: "text-muted hover:text-accent" })}
    >
      <ExternalIcon className="size-4" />
    </a>
  );
}

// 라벨: 분류·이름 한 줄 + 출처·날짜 한 줄 (넓은 표에선 한 줄로 자르고 전체 글은 title로)
function TagText({ tag, clip = false }: { tag: NonNullable<TransferRow["tag"]>; clip?: boolean }) {
  const name = `${labelStyle(tag.category).name}${tag.name ? ` · ${tag.name}` : ""}`;
  const source = `${tag.source}${tag.updated ? ` · ${tag.updated}` : ""}${tag.community ? " · 커뮤니티 조사" : ""}`;
  return (
    <>
      <span className="flex items-center gap-1.5 text-sm text-fg" title={clip ? name : undefined}>
        <CategoryMark category={tag.category} />
        <span className={clip ? "truncate" : ""}>{name}</span>
      </span>
      <span
        className={`mt-0.5 block pl-[18px] text-xs text-muted num ${clip ? "truncate" : ""}`}
        title={clip ? source : undefined}
      >
        {source}
      </span>
    </>
  );
}

export default function TransferTable({ rows, truncated = false }: { rows: TransferRow[]; truncated?: boolean }) {
  const hasLabels = rows.some((row) => row.tag);
  const [view, setView] = useState<View>(hasLabels ? "major" : "all");
  const [direction, setDirection] = useState<Direction>("all");
  const [sort, setSort] = useState<Sort>(hasLabels ? "amount" : "recent");
  const [showDust, setShowDust] = useState(false);
  const wide = useMedia("(min-width: 768px)");
  const pageSize = wide ? 50 : 20;
  const [pages, setPages] = useState(1);
  const lookalikes = useMemo(() => findLookalikes(rows), [rows]);

  const isDust = (row: TransferRow) => row.direction === "in" && row.valueEth < DUST_ETH;
  const dustCount = useMemo(() => rows.filter(isDust).length, [rows]);
  const major = useMemo(() => {
    const kept = rows.filter((row) => !isDust(row));
    const top = new Set([...kept].sort((a, b) => b.valueEth - a.valueEth).slice(0, TOP_BY_VALUE).map((row) => row.id));
    return kept.filter((row) => row.tag || top.has(row.id));
  }, [rows]);

  const base = view === "major" ? major : showDust ? rows : rows.filter((row) => !isDust(row));
  const filtered = useMemo(() => {
    const list = direction === "all" ? base : base.filter((row) => row.direction === direction);
    // 기록은 이미 최신순. 금액순은 ETH 환산값으로 (같으면 최신순 유지)
    return sort === "amount" ? [...list].sort((a, b) => b.valueEth - a.valueEth) : list;
  }, [base, direction, sort]);
  const visible = pages * pageSize;
  const shown = filtered.slice(0, visible);

  // 마지막 '더 보기'를 누르면 버튼이 사라져서 키보드 초점이 길을 잃음 → 끝 안내문으로 옮김
  const endRef = useRef<HTMLParagraphElement>(null);
  const focusEnd = useRef(false);
  useEffect(() => {
    if (focusEnd.current) {
      focusEnd.current = false;
      endRef.current?.focus();
    }
  }, [pages]);

  const count = (list: TransferRow[], dir: Direction) =>
    dir === "all" ? list.length : list.filter((row) => row.direction === dir).length;
  const anyLookalike = shown.some((row) => row.counterparty && lookalikes.has(row.counterparty));

  const notes: Note[] = [];
  if (truncated) notes.push({ lead: "기록 1,000건", text: "받은 쪽이나 보낸 쪽 기록이 1,000건이 넘어서 최근 1,000건만 가져왔어요." });
  notes.push({
    lead: "토큰",
    text: `이름만 ETH·USDT인 가짜 토큰이 많아서, 컨트랙트 주소로 확인된 ${KNOWN_SYMBOLS.join(", ")}만 보여줘요.`,
  });
  notes.push({ lead: "종류", text: "일반 = 지갑이 직접 보낸 ETH · 내부 = 컨트랙트(자동 프로그램)가 보낸 ETH · 토큰 = ERC-20 토큰" });
  if (anyLookalike) {
    notes.push({
      lead: "닮은 주소",
      text: "밑줄 친 앞 4글자·뒤 4글자가 같은 다른 주소가 이 표에 있어요. 주소 오염 공격(닮은 주소로 복사 실수를 노리는 사기)일 수 있어요.",
    });
  }

  const resetPages = () => setPages(1);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 print:hidden">
        {hasLabels && (
          <SegmentedControl
            label="보기"
            options={[
              { value: "major", label: "주요 거래", count: major.length },
              { value: "all", label: "전체", count: rows.length },
            ]}
            value={view}
            onChange={(next) => {
              setView(next);
              setSort(next === "major" ? "amount" : "recent");
              resetPages();
            }}
          />
        )}
        <SegmentedControl
          label="방향으로 거르기"
          options={[
            { value: "all", label: "전체", count: count(base, "all") },
            { value: "in", label: "받음", count: count(base, "in") },
            { value: "out", label: "보냄", count: count(base, "out") },
          ]}
          value={direction}
          onChange={(next) => {
            setDirection(next);
            resetPages();
          }}
        />
        <button
          type="button"
          onClick={() => {
            setSort((value) => (value === "amount" ? "recent" : "amount"));
            resetPages();
          }}
          className={buttonClass({ variant: "secondary", size: "sm" })}
        >
          <SortIcon className="size-4 text-muted" />
          {sort === "amount" ? "금액 큰 순" : "최신 순"}
          <span className="sr-only"> (누르면 {sort === "amount" ? "최신 순" : "금액 큰 순"}으로)</span>
        </button>
        {view === "all" && dustCount > 0 && (
          <p className="flex items-center gap-1 text-sm text-fg-2 md:ml-auto">
            받은 먼지(0.01 ETH 미만) {dustCount.toLocaleString("en-US")}건을 {showDust ? "보여주고 있어요" : "숨겼어요"}
            <button
              type="button"
              aria-pressed={showDust}
              onClick={() => {
                setShowDust((value) => !value);
                resetPages();
              }}
              className={buttonClass({ variant: "ghost", size: "sm", className: "px-2 text-accent hover:text-accent-strong" })}
            >
              {showDust ? "숨기기" : "보이기"}
            </button>
          </p>
        )}
      </div>

      {/* 인쇄(PDF)에는 지금 보고 있는 목록에서 앞 50건만 */}
      <p className="hidden text-xs text-muted print:block">
        {view === "major" ? "주요 거래" : "전체"} {filtered.length.toLocaleString("en-US")}건
        {filtered.length > 50 && " 중 앞 50건만 실었어요"} · {sort === "amount" ? "금액 큰 순" : "최신 순"}
      </p>
      <div className="mt-4 overflow-hidden rounded-xl border border-line-strong bg-surface">
        {shown.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-fg-2">표시할 송금 기록이 없어요.</p>
        ) : (
          <div className="relative overflow-x-auto print:overflow-visible">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line-strong bg-surface-2 text-xs font-semibold text-muted">
                <tr>
                  <th scope="col" className="hidden px-4 py-2.5 font-semibold whitespace-nowrap md:table-cell print:table-cell">
                    시간 (한국)
                  </th>
                  <th scope="col" className="py-2.5 pl-3 font-semibold md:px-4 print:px-4">
                    <span className="sr-only md:not-sr-only print:not-sr-only">방향</span>
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-semibold whitespace-nowrap md:px-4">
                    상대 주소
                  </th>
                  <th scope="col" className="hidden px-4 py-2.5 font-semibold lg:table-cell print:hidden">
                    라벨
                  </th>
                  <th scope="col" className="px-2 py-2.5 text-right font-semibold md:px-4">
                    금액
                  </th>
                  <th scope="col" className="hidden py-2.5 pr-4 font-semibold md:table-cell print:table-cell">
                    <span className="sr-only">단위</span>
                  </th>
                  <th scope="col" className="hidden px-4 py-2.5 font-semibold xl:table-cell">
                    종류
                  </th>
                  <th scope="col" className="hidden py-2.5 pr-3 md:table-cell print:hidden">
                    <span className="sr-only">거래 상세</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line print:[&>tr:nth-child(n+51)]:hidden">
                {shown.map((row) => {
                  const dir = DIRECTION[row.direction];
                  const category = CATEGORY_LABEL[row.category];
                  const [integer, fraction] = splitAmount(row.amount);
                  const lookalike = Boolean(row.counterparty && lookalikes.has(row.counterparty));
                  return (
                    <tr key={row.id} className="align-top transition-colors hover:bg-surface-2">
                      <td className="hidden px-4 py-3 whitespace-nowrap text-muted num md:table-cell print:table-cell">
                        {row.time}
                      </td>
                      <td className="py-3 pl-3 whitespace-nowrap md:px-4 print:px-4">
                        <span className={`inline-flex items-center gap-1.5 ${dir.className}`}>
                          <DirectionIcon direction={row.direction} />
                          <span className="sr-only md:not-sr-only print:not-sr-only">{dir.label}</span>
                        </span>
                      </td>
                      {/* 좁은 화면: 주소 칸이 남는 폭을 다 쓰고 라벨은 그 안에서 잘림 (표가 옆으로 넘치지 않게) */}
                      <td className="w-full max-w-0 px-2 py-3 md:px-4 lg:w-auto lg:max-w-none print:w-full print:max-w-0">
                        {row.counterparty ? (
                          <Link
                            href={`/trace/${row.counterparty}`}
                            prefetch={false}
                            rel="nofollow"
                            title={`${row.counterparty} 추적하기`}
                            className="focus-ring relative rounded-sm text-fg-2 underline decoration-line-control decoration-dotted underline-offset-[5px] transition-colors after:absolute after:-inset-2 hover:text-accent hover:decoration-accent"
                          >
                            <Address address={row.counterparty} variant="short" lookalike={lookalike} className="text-[13px] sm:text-sm" />
                            <span className="sr-only"> 추적하기</span>
                          </Link>
                        ) : (
                          <span className="text-muted">컨트랙트 생성</span>
                        )}
                        {lookalike && (
                          <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-warn">
                            <AlertIcon className="size-3.5" />
                            닮은 주소
                          </span>
                        )}
                        {/* 좁은 화면: 라벨·시간을 주소와 같은 왼쪽 선에 차례로 */}
                        {row.tag && (
                          <span className="mt-1.5 block lg:hidden print:block">
                            <TagText tag={row.tag} clip />
                          </span>
                        )}
                        <span className="mt-1 block text-xs text-muted num md:hidden print:hidden">{row.time}</span>
                      </td>
                      <td className="hidden w-[30%] max-w-0 px-4 py-3 lg:table-cell print:hidden">
                        {row.tag ? <TagText tag={row.tag} clip /> : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-2 py-3 text-right whitespace-nowrap md:px-4">
                        <span className="text-fg num">
                          {integer}
                          <span className="inline-block text-left md:w-[7ch] print:w-[7ch]">{fraction}</span>
                        </span>
                        {/* 좁은 화면: 단위 + 거래 상세를 금액 아래에 */}
                        <span className="mt-0.5 flex items-center justify-end gap-1 text-xs text-muted md:hidden print:hidden">
                          {row.symbol}
                          <span className="-my-2 -mr-2">
                            <TxLink hash={row.hash} />
                          </span>
                        </span>
                      </td>
                      <td className="hidden py-3 pr-4 whitespace-nowrap text-muted md:table-cell print:table-cell">
                        {row.symbol}
                      </td>
                      <td className="hidden px-4 py-3 whitespace-nowrap text-fg-2 xl:table-cell">
                        <span title={category.title}>{category.text}</span>
                      </td>
                      <td className="hidden py-1.5 pr-3 text-right md:table-cell print:hidden">
                        <TxLink hash={row.hash} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > visible ? (
          <button
            type="button"
            onClick={() => {
              if (visible + pageSize >= filtered.length) focusEnd.current = true;
              setPages((n) => n + 1);
            }}
            className="focus-ring-inset flex h-12 w-full items-center justify-center gap-2 border-t border-line-strong text-sm font-medium text-fg transition-colors hover:bg-surface-2 print:hidden"
          >
            더 보기
            <span className="text-xs font-normal text-muted num">
              {visible.toLocaleString("en-US")} / {filtered.length.toLocaleString("en-US")}
            </span>
          </button>
        ) : (
          filtered.length > pageSize && (
            <p
              ref={endRef}
              tabIndex={-1}
              className="border-t border-line px-4 py-3 text-center text-xs text-muted num focus:outline-hidden print:hidden"
            >
              {filtered.length.toLocaleString("en-US")}건을 모두 표시했어요
            </p>
          )
        )}
      </div>

      <Notes notes={notes} className="mt-4" />
    </div>
  );
}
