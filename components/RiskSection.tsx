import Link from "next/link";
import { AlertIcon } from "@/components/icons";
import { redactKey } from "@/lib/alchemy";
import { analyzeRisk, type RiskReport } from "@/lib/exposure";
import RiskCard from "./RiskCard";
import SectionHead from "./ui/SectionHead";

// 점수는 상대 주소 몇 곳을 한 단계 더 조회해서 몇 초 걸림 → 그래프처럼 따로 불러옴 (TraceResult의 Suspense)
// saved = 데모 저장본의 점수 (있으면 조회 없이 바로)
export default async function RiskSection({ address, saved }: { address: string; saved?: RiskReport }) {
  if (saved) return <RiskCard report={saved} />;
  const report = await analyzeRisk(address)
    .then(({ report }) => report)
    .catch((error) => {
      console.error(`[risk] failed: ${redactKey(String(error))}`);
      return null;
    });
  if (!report) {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-line bg-surface px-4 py-6 text-sm text-warn">
        <AlertIcon className="mt-0.5 size-4" />
        위험 점수를 계산하지 못했어요. 잠시 후 새로 고침해 주세요.
      </p>
    );
  }
  return <RiskCard report={report} />;
}

// 단원 머리 (결과 화면과 로딩 화면이 같이 씀 → 높이가 같게)
export function RiskIntro({ titleId }: { titleId?: string }) {
  return (
    <SectionHead number="01" title="위험 점수" titleId={titleId}>
      제재·해커·믹서 주소와 얼마나 얽혔는지 0~100점으로 매겨요.{" "}
      <Link
        href="/sources#score"
        className="focus-ring rounded-sm font-medium whitespace-nowrap text-fg underline decoration-line-control underline-offset-4 transition-colors hover:text-accent"
      >
        계산법 자세히
      </Link>
    </SectionHead>
  );
}

// 로딩 화면 높이용 자리표시 카드 (이유 3줄, '더 보기' 없음, 안내 2줄 = 흔한 모양)
const PLACEHOLDER: RiskReport = {
  score: 0,
  grade: "low",
  gradeName: "낮음",
  sides: { in: { score: 0, totalEth: 1, coverage: 1 }, out: { score: 0, totalEth: 1, coverage: 1 } },
  reasons: [
    { kind: "self", category: "sanctioned", source: "미국 재무부 OFAC 제재 목록 (0xB10C 정리본)", community: false, points: 90 },
    { kind: "sent-sanctioned", valueEth: 144_835, points: 90 },
    { kind: "exposure", side: "out", hop: 1, category: "hacker", share: 0.25, valueEth: 47_874, points: 22, added: 6 },
  ],
  victim: false,
  truncated: { in: false, out: false },
  approx: false,
  failed: 0,
  estimated: 0,
  grouped: 0,
  sampled: 0,
};

const BAR = "rounded-md bg-surface-2 motion-safe:animate-pulse";

// 보이지 않는 자리표시 카드 위에 로딩 모양을 덮음 → 점수가 와도 아래 그래프가 덜 밀림
export function RiskSkeleton() {
  return (
    <div aria-busy="true" className="relative">
      <div aria-hidden="true" className="invisible">
        <RiskCard report={PLACEHOLDER} beacon={false} />
      </div>
      <div className="absolute inset-0 rounded-xl border border-line-strong bg-surface p-4 sm:p-7">
        <p role="status" className="text-[15px] text-fg-2">
          점수를 계산하는 중이에요… 상대 주소 몇 곳을 한 단계 더 조회해요.
        </p>
        <div className={`mt-5 h-16 w-28 ${BAR}`} />
        <div className="mt-6 flex max-w-sm gap-[3px]">
          {[20, 30, 30, 20].map((width, i) => (
            <div key={i} className="h-3 rounded-[3px] border border-line-control" style={{ width: `${width}%` }} />
          ))}
        </div>
        <div className="mt-8 space-y-3">
          <div className={`h-4 w-3/4 max-w-md ${BAR}`} />
          <div className={`h-4 w-2/3 max-w-sm ${BAR}`} />
          <div className={`h-4 w-1/2 max-w-xs ${BAR}`} />
        </div>
      </div>
    </div>
  );
}
