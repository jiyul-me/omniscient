// 서버(lib/tracer.ts)가 만들고 브라우저(components/FlowGraph.tsx)가 그리는 그래프 데이터 모양
// 브라우저에서도 쓰는 파일이라 viem 같은 무거운 의존성 금지
import type { LabelCategory } from "./categories";

export type Side = "in" | "out"; // in = 돈이 들어온 쪽(출처), out = 돈이 나간 쪽(사용처)

export type NodeState =
  | "expanded" // 이미 한 단계 더 펼침
  | "expandable" // 누르면 펼칠 수 있음
  | "terminal" // 거래소·DEX·브릿지·믹서 라벨이라 멈춤 (브레이크 ④)
  | "hub" // 라벨은 없지만 거래가 너무 많아 멈춤 (거래소·서비스일 가능성)
  | "leaf" // 더 따라갈 송금 없음
  | "limit"; // 최대 단계라 멈춤

// 라벨 (data/labels.json). 출처와 날짜를 툴팁에 보여줌
export type NodeTag = {
  category: LabelCategory;
  name: string;
  source: string;
  sourceUrl: string;
  updated: string;
  community: boolean;
};

export type BundleMember = {
  id: string; // 소문자 주소
  address: string; // 체크섬
  amountLabel: string;
  valueEth: number;
  count: number; // 이 주소와 오간 송금 건수
  firstAt: number; // 처음·마지막 송금 시각 (밀리초)
  lastAt: number;
  tag?: NodeTag;
};

export type GraphNode = {
  id: string; // 주소(소문자) 또는 "bundle:…"
  kind: "center" | "address" | "bundle";
  address: string | null; // 체크섬 (묶음은 null)
  side: Side | null; // 시작 주소는 null
  hop: number; // 시작 주소에서 몇 단계 떨어졌는지
  label: string; // 점 아래에 쓰는 짧은 이름
  valueEth: number; // 이 점과 오간 금액 (ETH 환산, 점 크기용)
  state: NodeState;
  group?: string; // 비슷한 금액 묶음에 속하면 그 이름 (예: "10,000 ETH × 40")
  members?: BundleMember[]; // 접힌 묶음만
  tag?: NodeTag; // 라벨이 있는 주소만
};

export type GraphLink = {
  id: string; // "from->to"
  source: string; // 돈이 나간 주소 (노드 id)
  target: string; // 돈이 들어간 주소 (노드 id)
  valueEth: number;
  amountLabel: string; // 예: "10,000 ETH", "3,500,000 USDC 외 1종"
  count: number; // 합친 송금 건수
  firstAt: number; // 처음·마지막 송금 시각 (밀리초, 시간 슬라이더가 이 순서로 보여줌)
  lastAt: number;
};

export type GraphData = {
  centerId: string;
  nodes: GraphNode[];
  links: GraphLink[];
  notes: string[]; // 화면에 보여줄 안내
  totals: Record<Side, number>; // 시작 주소가 받은·보낸 금액 (ETH 환산, 먼지 제외)
};

// 펼치기 API(/api/graph/expand) 응답
export type ExpandResult = {
  focus: { id: string; state: NodeState };
  nodes: GraphNode[];
  links: GraphLink[];
};

export function linkId(from: string, to: string) {
  return `${from}->${to}`;
}

// 그래프 옆 '주요 흐름' 목록: 시작 주소가 라벨 있는 상대와 직접 주고받은 돈을 분류·방향별로 합친 것
// (받은 먼지 제외, 점수의 1단계 노출과 같은 기준). 서버(components/TraceResult.tsx)가 송금 기록으로 만듦
export type FlowSummary = {
  side: Side;
  category: LabelCategory;
  valueEth: number;
  share: number; // 그쪽 전체 금액 중 비율 (0~1)
  count: number; // 서로 다른 상대 수
};
