import Link from "next/link";
import GradeChip from "@/components/GradeChip";
import { ArrowRightIcon } from "@/components/icons";
import { labelStyle } from "@/lib/categories";
import { DEMO_CASES, demoHref } from "@/lib/demos";
import { formatPercent } from "@/lib/format";
import { getTag } from "@/lib/labels";
import type { RiskReason } from "@/lib/risk";
import { shapeOf, shapePath } from "@/lib/shapes";
import { loadSnapshot } from "@/lib/snapshots";

// 첫 화면 오른쪽 '결과 미리보기': Bybit 데모 저장본의 실제 점수·이유 + 정해진 배치의 작은 그래프 (힘 계산 없는 정적 SVG)
// 카드 전체가 Bybit 데모 링크
const DEMO_ID = "bybit";
const W = 440;
const H = 236;
const CENTER = { x: 168, y: 118 };

function reasonLine(reason: RiskReason) {
  if (reason.kind === "self") return { text: `이 주소 자체가 ${labelStyle(reason.category).name} 라벨`, points: `최소 ${reason.points}점` };
  if (reason.kind === "sent-sanctioned") return { text: "제재 주소로 직접 돈을 보냄", points: `최소 ${reason.points}점` };
  return {
    text: `${labelStyle(reason.category).name} · ${reason.side === "out" ? "보낸 돈" : "받은 돈"}의 ${formatPercent(reason.share)}`,
    points: `+${reason.added}점`,
  };
}

export default function ResultPreview() {
  const demo = DEMO_CASES.find((d) => d.id === DEMO_ID);
  const snapshot = loadSnapshot(DEMO_ID);
  if (!demo || !snapshot) return null;
  const { graph, risk } = snapshot;
  const centerTag = getTag(snapshot.history.address);

  // 가장 큰 비슷한 금액 묶음 (Bybit: '10,000 ETH × 40')을 부채꼴로
  const counts = new Map<string, number>();
  for (const node of graph.nodes) {
    if (node.kind === "address" && node.group && node.side === "out" && node.hop === 1) {
      counts.set(node.group, (counts.get(node.group) ?? 0) + 1);
    }
  }
  const [fanLabel, fanCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  const fanCategory = graph.nodes.find((node) => node.group === fanLabel)?.tag?.category;
  const victim = graph.nodes.find((node) => node.side === "in" && node.hop === 1 && node.tag?.category === "victim");
  const fan = Array.from({ length: fanCount }, (_, i) => {
    const t = fanCount > 1 ? i / (fanCount - 1) : 0.5;
    const angle = (-62 + 124 * t) * (Math.PI / 180);
    return { x: CENTER.x + Math.cos(angle) * 196, y: CENTER.y + Math.sin(angle) * 104 };
  });
  const reasons = risk.reasons.filter((r) => r.kind !== "exposure" || r.added > 0).slice(0, 2).map(reasonLine);

  return (
    <Link
      href={demoHref(demo)}
      className="focus-ring group block overflow-hidden rounded-2xl border border-line-strong bg-surface transition-colors hover:border-line-control"
    >
      <span className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3">
        <span className="text-sm font-semibold text-fg">결과 미리보기</span>
        <span className="text-xs text-muted num">
          {demo.title} 데모 · {snapshot.capturedAt} 기준
        </span>
      </span>
      <span className="block bg-dot-grid">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${demo.title} 자금 흐름 그래프 미리보기`} className="block h-auto w-full">
          {victim && (
            <>
              <path d={`M66 ${CENTER.y}H${CENTER.x - 24}`} stroke="#8f8c83" strokeWidth="1.6" />
              <path d={`M${CENTER.x - 29} ${CENTER.y - 4}l5 4-5 4`} fill="none" stroke="#5d6370" strokeWidth="1.4" />
              <path d={shapePath("circle", 58, CENTER.y, 7)} fill={labelStyle("victim").color} />
              <text x="62" y={CENTER.y + 30} textAnchor="middle" fontSize="16" fill="#3e434c">
                해킹 피해 지갑
              </text>
            </>
          )}
          {fan.map((point, i) => (
            <path key={i} d={`M${CENTER.x} ${CENTER.y}L${point.x} ${point.y}`} stroke="#8f8c83" strokeWidth="0.7" />
          ))}
          {fan.map((point, i) => (
            <path key={i} d={shapePath(shapeOf(fanCategory), point.x, point.y, 3.2)} fill={labelStyle(fanCategory).color} />
          ))}
          <circle cx={CENTER.x} cy={CENTER.y} r="18" fill="none" stroke="#15171c" strokeWidth="1.5" />
          <circle cx={CENTER.x} cy={CENTER.y} r="22.5" fill="none" stroke="#15171c" strokeWidth="1" />
          <path d={shapePath(shapeOf(centerTag?.category), CENTER.x, CENTER.y, 10)} fill={labelStyle(centerTag?.category).color} />
          <g>
            <rect x={CENTER.x - 40} y={CENTER.y + 30} width="80" height="27" rx="4" fill="#fff" stroke="#15171c" />
            <text x={CENTER.x} y={CENTER.y + 49} textAnchor="middle" fontSize="16" fontWeight="650" fill="#15171c">
              시작 주소
            </text>
          </g>
          {fanLabel && (
            <g>
              <rect x={W - 150} y={H - 34} width="140" height="27" rx="4" fill="#fff" stroke="#7f848d" />
              <text x={W - 80} y={H - 15} textAnchor="middle" fontSize="16" fontWeight="650" fill="#15171c">
                {fanLabel}
              </text>
            </g>
          )}
        </svg>
      </span>
      <span className="block border-t border-line px-5 py-4">
        <span className="flex items-center justify-between gap-3">
          <span className="flex items-baseline gap-1.5">
            <span className="text-[44px] leading-[44px] font-bold tracking-[-0.03em] text-fg num">{risk.score}</span>
            <span className="text-sm text-muted">/ 100점</span>
          </span>
          <GradeChip score={risk.score} gradeName={risk.gradeName} size="lg" />
        </span>
        <span className="mt-3 block space-y-1.5">
          {reasons.map((reason, i) => (
            <span key={reason.text} className={`flex items-center justify-between gap-3 text-sm ${i > 0 ? "max-sm:hidden" : ""}`}>
              <span className="text-fg-2">{reason.text}</span>
              <span className="shrink-0 font-semibold text-fg num">{reason.points}</span>
            </span>
          ))}
        </span>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent group-hover:underline group-hover:underline-offset-4">
          결과 전체 보기
          <ArrowRightIcon className="size-4" />
        </span>
      </span>
    </Link>
  );
}
