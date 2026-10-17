// 2D 그래프(FlowGraph·ForceGraphCanvas)와 3D 그래프(Graph3D)가 같이 쓰는 모양·힘·글자
// 브라우저에서 쓰는 파일 (three.js 같은 무거운 의존성 금지: 3D 전용은 components/graph/Graph3D.tsx)
import { CATEGORY_STYLE, labelStyle } from "@/lib/categories";
import type { GraphLink, GraphNode, NodeState, NodeTag } from "@/lib/graph";
import { GRAPH } from "@/lib/risk-config";
import { shapeOf, shapePath, type Shape } from "@/lib/shapes";

// 캔버스는 CSS 변수를 못 읽어서 app/globals.css 토큰 값을 그대로 씀 (흰 판 기준, 밝은 리포트 디자인)
export const COLOR = {
  fg: "#15171c",
  fg2: "#3e434c",
  muted: "#5d6370",
  control: "#7f848d",
  link: "#8f8c83",
  pill: "#ffffff",
  pillBorder: "#d2cfc6",
  accent: "#0a6878",
  unknown: CATEGORY_STYLE.unknown.color,
};

// 캔버스 글꼴은 화면 글꼴(Pretendard·Geist Mono)을 그대로 읽어서 씀 (처음 그릴 때 한 번)
let fontCache: { sans: string; mono: string } | null = null;
export function graphFonts() {
  if (fontCache) return fontCache;
  if (typeof document === "undefined") return { sans: "sans-serif", mono: "monospace" };
  const probe = document.createElement("span");
  probe.className = "font-mono";
  probe.hidden = true;
  document.body.append(probe);
  fontCache = {
    sans: getComputedStyle(document.body).fontFamily || "sans-serif",
    mono: getComputedStyle(probe).fontFamily || "monospace",
  };
  probe.remove();
  return fontCache;
}

// 단계마다 좌우로 벌어지는 거리 (받은 쪽은 왼쪽, 보낸 쪽은 오른쪽)
const SPREAD = 130;

// 그래프 라이브러리가 위치(x, y, z)와 연결(source/target → 점 객체)을 직접 채워 넣음
export type FGNode = GraphNode & {
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  fx?: number;
  fy?: number;
  fz?: number;
};
export type FGLink = Omit<GraphLink, "source" | "target"> & {
  source: string | FGNode;
  target: string | FGNode;
};
export type GraphState = { nodes: FGNode[]; links: FGLink[] };

export const endId = (end: string | FGNode) => (typeof end === "string" ? end : end.id);

export function radius(node: GraphNode) {
  if (node.kind === "center") return 7;
  return Math.min(2 + 1.1 * Math.log10(1 + node.valueEth), 8);
}

export const linkWidth = (link: FGLink) => Math.min(0.4 + 0.3 * Math.log10(1 + link.valueEth), 2.2);
export const particleCount = (link: FGLink) =>
  link.valueEth >= 1000 ? 4 : link.valueEth >= 10 ? 2 : 1;

// 모양의 가장 먼 꼭짓점이 가운데에서 얼마나 떨어졌는지 (반지름 대비, lib/shapes.ts 크기와 맞춤)
export const SHAPE_REACH: Record<Shape, number> = {
  circle: 1,
  square: 1.27,
  diamond: 1.25,
  triangle: 1.55,
  "triangle-down": 1.55,
  hexagon: 1.1,
};

// 점 위에 이름을 늘 보여줄 라벨 (해커는 꽃잎마다 붙어 있어서 툴팁에서만)
export const NAMED_CATEGORIES = new Set(["sanctioned", "mixer", "bridge", "exchange", "dex", "victim"]);

export function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export function tagText(tag: NodeTag) {
  return `${labelStyle(tag.category).name}${tag.name ? ` · ${tag.name}` : ""}`;
}

// 날짜(2022-08-08)는 줄 중간에서 끊기지 않게 따로 둠 → 툴팁·패널에서 nowrap으로 감쌈
export function sourceParts(tag: NodeTag) {
  return {
    source: `출처: ${tag.source}`,
    date: tag.updated,
    note: tag.community ? " (커뮤니티 조사라 틀릴 수 있어요)" : "",
  };
}

function sourceHtml(tag: NodeTag) {
  const { source, date, note } = sourceParts(tag);
  const dateHtml = date ? ` · <span style="white-space:nowrap">${escapeHtml(date)}</span>` : "";
  return `${escapeHtml(source)}${dateHtml}${escapeHtml(note)}`;
}

export const STATE_TEXT: Record<NodeState, string> = {
  expanded: "펼쳐진 주소예요",
  expandable: "누르면 한 단계 더 펼쳐져요",
  terminal: "돈이 다른 돈과 섞이는 곳이라 여기서 멈춰요",
  hub: "거래가 1,000건이 넘어서 멈춘 주소예요 (거래소·서비스일 수 있어요)",
  leaf: "더 따라갈 송금이 없어요",
  limit: `${GRAPH.maxHop}단계까지만 펼칠 수 있어요`,
};

// 멈춘 이유: 브릿지는 다른 체인으로 나가는 출구, 나머지는 다른 사람 돈과 섞이는 곳
export function stateText(node: GraphNode, state: NodeState) {
  if (state === "terminal" && node.tag?.category === "bridge") {
    return "다른 블록체인으로 나가는 출구라 여기서 멈춰요";
  }
  return STATE_TEXT[state];
}

export function sideText(node: GraphNode) {
  if (node.kind === "center") return "시작 주소";
  return `돈이 ${node.side === "in" ? "들어온" : "나간"} 쪽 · ${node.hop}단계 연결`;
}

// 마우스를 올렸을 때 뜨는 설명 (innerHTML로 들어가서 글자는 전부 escape). 분류는 '●' 글자 대신 그래프와 같은 모양
export function tooltipHtml(node: FGNode, state: NodeState, centerAmounts: string, formatEth: (v: number) => string) {
  const mono = graphFonts().mono.replace(/"/g, "'");
  const address = node.kind === "bundle" ? null : (node.address ?? null);
  const mark = node.tag
    ? `<svg width="12" height="12" viewBox="0 0 20 20" style="overflow:visible;flex-shrink:0"><path d="${shapePath(shapeOf(node.tag.category), 10, 10, 8.5)}" fill="${labelStyle(node.tag.category).color}"/></svg>`
    : "";
  const lines = [
    node.tag
      ? `<span style="display:flex;align-items:center;gap:6px;font-weight:600;color:${COLOR.fg}">${mark}${escapeHtml(tagText(node.tag))}</span>`
      : node.kind === "center"
        ? `<span style="font-weight:600;color:${COLOR.fg}">시작 주소</span>`
        : "",
    address
      ? `<span style="font-family:${mono};color:${COLOR.fg}">${escapeHtml(address.slice(0, 22))}<br>${escapeHtml(address.slice(22))}</span>`
      : `<strong style="color:${COLOR.fg}">${escapeHtml(node.label)}</strong>`,
    node.tag ? `<span style="color:${COLOR.muted}">${sourceHtml(node.tag)}</span>` : "",
    escapeHtml(sideText(node)),
    node.kind === "address" && node.group ? `비슷한 금액 묶음 ${escapeHtml(node.group)}` : "",
    node.kind === "center" ? escapeHtml(centerAmounts) : `${escapeHtml(formatEth(node.valueEth))} 상당`,
    node.kind === "bundle"
      ? `누르면 ${node.members?.length ?? 0}개로 펼쳐져요`
      : node.kind === "address"
        ? escapeHtml(stateText(node, state))
        : "",
  ].filter(Boolean);
  return lines.join("<br>");
}

export function linkTooltip(link: FGLink) {
  return escapeHtml(`${link.amountLabel}${link.count > 1 ? ` · 송금 ${link.count}건` : ""}`);
}

// 받은 쪽 점은 왼쪽, 보낸 쪽 점은 오른쪽으로 끌어당기는 힘 (돈이 왼쪽 → 오른쪽으로 흐르게)
// 기준은 시작 주소 위치 (끌어서 옮겨도 좌우가 유지되게). 3D에서도 x만 당겨서 그대로 씀
function sideForce(strength = 0.2) {
  let nodes: FGNode[] = [];
  let origin: FGNode | undefined;
  const force = (alpha: number) => {
    const ox = origin?.x ?? 0;
    for (const node of nodes) {
      const offset =
        node.side === "in" ? -node.hop * SPREAD : node.side === "out" ? node.hop * SPREAD : 0;
      node.vx = (node.vx ?? 0) + (ox + offset - (node.x ?? 0)) * strength * alpha;
    }
  };
  force.initialize = (initial: object[]) => {
    nodes = initial as FGNode[];
    origin = nodes.find((node) => node.kind === "center");
  };
  return force;
}

// 점끼리 겹치면 밀어냄 (꽃잎 40개가 한 덩어리로 뭉치지 않게). 점이 200개 안팎이라 전부 비교해도 충분히 빠름
// 3D에서는 깊이(z)도 같이 봄 (깊이로 떨어진 점을 화면상 겹친다고 밀어내지 않게)
function collideForce(padding = 3) {
  let nodes: FGNode[] = [];
  let dims = 2;
  const force = () => {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = (b.x ?? 0) - (a.x ?? 0) || 0.01;
        const dy = (b.y ?? 0) - (a.y ?? 0) || 0.01;
        const dz = dims === 3 ? (b.z ?? 0) - (a.z ?? 0) : 0;
        const distance = Math.hypot(dx, dy, dz);
        const min = radius(a) + radius(b) + padding;
        if (distance >= min) continue;
        const push = ((min - distance) / distance) * 0.5;
        // 가운데 고정된 시작 주소는 움직이지 않으니 상대만 밀어냄
        const aShare = a.fx === undefined ? 0.5 : 0;
        const bShare = b.fx === undefined ? 0.5 : 0;
        const aMove = (aShare / (aShare + bShare || 1)) * 2 * push;
        const bMove = (bShare / (aShare + bShare || 1)) * 2 * push;
        a.x = (a.x ?? 0) - dx * aMove;
        a.y = (a.y ?? 0) - dy * aMove;
        b.x = (b.x ?? 0) + dx * bMove;
        b.y = (b.y ?? 0) + dy * bMove;
        if (dims === 3) {
          a.z = (a.z ?? 0) - dz * aMove;
          b.z = (b.z ?? 0) + dz * bMove;
        }
      }
    }
  };
  force.initialize = (initial: object[], _random?: unknown, numDimensions = 2) => {
    nodes = initial as FGNode[];
    dims = numDimensions;
  };
  return force;
}

// 2D·3D 그래프 공통 힘 설정. 라이브러리마다 d3Force 타입이 달라서 필요한 모양만 받음
type ForceLike = {
  strength?: (value: number) => ForceLike;
  distanceMax?: (value: number) => ForceLike;
  distance?: (value: (link: FGLink) => number) => ForceLike;
};
export type ForceHost = {
  d3Force: (...args: never[]) => unknown;
  d3ReheatSimulation: () => unknown;
};

export function configureForces(graph: ForceHost) {
  const d3Force = graph.d3Force as unknown as (name: string, force?: unknown) => ForceLike | undefined;
  d3Force("charge")?.strength?.(-40)?.distanceMax?.(360);
  // 1단계 선은 길게 (꽃잎이 넓게 퍼지게), 그 뒤는 짧게
  d3Force("link")?.distance?.((link) =>
    typeof link.target === "object" &&
    link.target.hop <= 1 &&
    typeof link.source === "object" &&
    link.source.hop <= 1
      ? 95
      : 60,
  );
  d3Force("side", sideForce());
  d3Force("collide", collideForce());
  // 라이브러리 기본 'center' 힘은 모든 점의 평균을 가운데로 끌어서, 보낸 쪽 점이 많으면 왼쪽으로 밀려남 → 끔
  // (시작 주소가 이미 가운데에 고정돼 있음)
  d3Force("center", null);
  graph.d3ReheatSimulation();
}

// 2D ↔ 3D 바꿀 때: 라이브러리가 붙인 내부 값(__… · 속도 · source/target 객체)을 지우고 새 객체로
// (두 라이브러리가 같은 객체를 쓰면 위치가 뒤엉킴). 3D는 z를 점마다 조금씩 다르게 (모두 0이면 평면에서 안 벗어남)
export function toMode(prev: GraphState, mode: "2d" | "3d"): GraphState {
  const nodes = prev.nodes.map((node) => {
    const clean: FGNode = {
      id: node.id,
      kind: node.kind,
      address: node.address,
      side: node.side,
      hop: node.hop,
      label: node.label,
      valueEth: node.valueEth,
      state: node.state,
      ...(node.group ? { group: node.group } : {}),
      ...(node.members ? { members: node.members } : {}),
      ...(node.tag ? { tag: node.tag } : {}),
      x: node.x,
      y: node.y,
    };
    if (mode === "3d") clean.z = node.kind === "center" ? 0 : (hash01(node.id) - 0.5) * 40;
    if (node.kind === "center") {
      clean.fx = 0;
      clean.fy = 0;
      if (mode === "3d") clean.fz = 0;
    }
    return clean;
  });
  const links = prev.links.map((link) => ({
    id: link.id,
    source: endId(link.source),
    target: endId(link.target),
    valueEth: link.valueEth,
    amountLabel: link.amountLabel,
    count: link.count,
    firstAt: link.firstAt,
    lastAt: link.lastAt,
  }));
  return { nodes, links };
}

// 주소마다 늘 같은 0~1 값 (3D 깊이 처음 위치용)
function hash01(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}
