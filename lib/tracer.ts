import "server-only";
import { formatUnits } from "viem";
import { toChecksum } from "./address";
import { fetchTransfers, redactKey, type Prices, type RawTransfer } from "./alchemy";
import { TERMINAL_CATEGORIES } from "./categories";
import { aggregate, bundleKey, pricesOrFallback, ZERO_ADDRESS, type Flow } from "./flows";
import { formatAmount, shortAddress } from "./format";
import {
  linkId,
  type ExpandResult,
  type GraphData,
  type GraphLink,
  type GraphNode,
  type NodeState,
  type Side,
} from "./graph";
import { getTag } from "./labels";
import { DUST_ETH, GRAPH } from "./risk-config";

// 여러 단계 추적 + 브레이크 4종
// ① 홉 제한: 기본 2단계까지 자동, 그 뒤는 클릭 ② 상위 N개 ③ 먼지 무시
// ④ 종착역: 거래소·DEX·브릿지·믹서 라벨(data/labels.json)에서 멈춤. 라벨이 없어도 거래가 1,000건 넘으면 멈춤

// 그래프에 그릴 상대: 먼지(DUST_ETH 미만)는 뺌 (스팸·주소 오염 방지)
function graphFlows(focal: string, side: Side, transfers: RawTransfer[], prices: Prices) {
  return aggregate(focal, side, transfers, prices).filter((flow) => flow.valueEth >= DUST_ETH);
}

type LinkInfo = Omit<GraphLink, "id" | "source" | "target">;

// 상대 하나와 오간 돈 → 그래프 선 정보 (금액·건수·처음/마지막 시각)
function linkInfo(flow: Flow): LinkInfo {
  return {
    valueEth: flow.valueEth,
    amountLabel: amountLabel(flow),
    count: flow.count,
    firstAt: flow.firstAt,
    lastAt: flow.lastAt,
  };
}

function amountLabel(flow: Flow) {
  const [main, ...rest] = flow.sums;
  const text = `${formatAmount(formatUnits(main.raw, main.token.decimals), 2)} ${main.token.symbol}`;
  return rest.length > 0 ? `${text} 외 ${rest.length}종` : text;
}

type Item =
  | { kind: "single"; flow: Flow; valueEth: number }
  | { kind: "bundle"; key: string; label: string; flows: Flow[]; valueEth: number };

// 비슷한 금액 묶음은 순위에서 1곳으로 셈 (묶음 하나가 상위 N개를 다 차지하지 않게)
function groupFlows(flows: Flow[]): Item[] {
  const byKey = new Map<string, Flow[]>();
  for (const flow of flows) {
    const key = bundleKey(flow);
    if (key) byKey.set(key, [...(byKey.get(key) ?? []), flow]);
  }
  const items: Item[] = [];
  const bundled = new Set<Flow>();
  for (const [key, group] of byKey) {
    if (group.length < GRAPH.bundleMin) continue;
    const labels = new Set(group.map(amountLabel));
    const label = `${labels.size === 1 ? "" : "약 "}${amountLabel(group[0])} × ${group.length}`;
    const valueEth = group.reduce((total, flow) => total + flow.valueEth, 0);
    items.push({ kind: "bundle", key, label, flows: group, valueEth });
    group.forEach((flow) => bundled.add(flow));
  }
  for (const flow of flows) {
    if (!bundled.has(flow)) items.push({ kind: "single", flow, valueEth: flow.valueEth });
  }
  return items.sort((a, b) => b.valueEth - a.valueEth);
}

// 새 점의 처음 상태: 소각 주소·종착역 라벨·최대 단계는 펼치지 않음
function initialState(id: string, hop: number, category?: string): NodeState {
  if (id === ZERO_ADDRESS) return "leaf";
  if (category && (TERMINAL_CATEGORIES as readonly string[]).includes(category)) return "terminal";
  return hop >= GRAPH.maxHop ? "limit" : "expandable";
}

class GraphBuilder {
  nodes = new Map<string, GraphNode>();
  links = new Map<string, GraphLink>();

  private ensureNode(id: string, side: Side, hop: number, valueEth: number, group?: string) {
    const existing = this.nodes.get(id);
    if (existing) {
      // 같은 단계에서 받은 쪽·보낸 쪽 양쪽에 다 나오면 금액이 큰 쪽으로 분류
      // (예: 업비트 해커에게 100 ETH를 되돌려 보내고 11만 ETH를 받은 주소 = 보낸 쪽)
      if (
        existing.kind === "address" &&
        existing.hop === hop &&
        existing.side !== side &&
        valueEth > existing.valueEth
      ) {
        existing.side = side;
        existing.valueEth = valueEth;
        if (group) existing.group = group;
        else delete existing.group;
        return { node: existing, added: true };
      }
      return { node: existing, added: false };
    }
    const address = toChecksum(id);
    const tag = getTag(id) ?? undefined;
    const node: GraphNode = {
      id,
      kind: "address",
      address,
      side,
      hop,
      label: id === ZERO_ADDRESS ? "0x0 (소각·발행)" : shortAddress(address),
      valueEth,
      state: initialState(id, hop, tag?.category),
      ...(group ? { group } : {}),
      ...(tag ? { tag } : {}),
    };
    this.nodes.set(id, node);
    return { node, added: true };
  }

  addLink(focal: string, other: string, side: Side, info: LinkInfo) {
    const [source, target] = side === "out" ? [focal, other] : [other, focal];
    const id = linkId(source, target);
    if (!this.links.has(id)) {
      this.links.set(id, { id, source, target, ...info });
    }
  }

  // 기준 주소의 상대들을 한 단계 붙임. 새로 생긴 단일 주소 점(묶음 제외)을 금액 순으로 돌려줌
  addNeighbors(focal: string, side: Side, hop: number, flows: Flow[], limit: number) {
    const added: GraphNode[] = [];
    for (const item of groupFlows(flows).slice(0, limit)) {
      if (item.kind === "single") {
        const { flow } = item;
        const { node, added: isNew } = this.ensureNode(flow.counterparty, side, hop, flow.valueEth);
        this.addLink(focal, node.id, side, linkInfo(flow));
        if (isNew) added.push(node);
        continue;
      }
      // 작은 묶음은 처음부터 펼쳐서 (꽃 모양), 큰 묶음은 점 하나로 접어서
      if (item.flows.length <= GRAPH.bundleShowMax) {
        for (const flow of item.flows) {
          const { node } = this.ensureNode(flow.counterparty, side, hop, flow.valueEth, item.label);
          this.addLink(focal, node.id, side, linkInfo(flow));
        }
        continue;
      }
      const id = `bundle:${focal}:${side}:${item.key}`;
      this.nodes.set(id, {
        id,
        kind: "bundle",
        address: null,
        side,
        hop,
        label: item.label,
        valueEth: item.valueEth,
        state: "expandable",
        group: item.label,
        members: item.flows.map((flow) => {
          const tag = getTag(flow.counterparty) ?? undefined;
          return {
            id: flow.counterparty,
            address: toChecksum(flow.counterparty),
            amountLabel: amountLabel(flow),
            valueEth: flow.valueEth,
            count: flow.count,
            firstAt: flow.firstAt,
            lastAt: flow.lastAt,
            ...(tag ? { tag } : {}),
          };
        }),
      });
      this.addLink(focal, id, side, {
        valueEth: item.valueEth,
        amountLabel: item.label,
        count: item.flows.reduce((total, flow) => total + flow.count, 0),
        firstAt: Math.min(...item.flows.map((flow) => flow.firstAt)),
        lastAt: Math.max(...item.flows.map((flow) => flow.lastAt)),
      });
    }
    return added;
  }

  // 한 주소를 같은 방향으로 한 단계 더 펼침 (보낸 쪽이면 그 주소가 보낸 곳, 받은 쪽이면 그 주소에 보낸 곳)
  async expand(address: string, side: Side, hop: number, prices: Prices, limit: number): Promise<NodeState> {
    const page = await fetchTransfers(address, side);
    // 브레이크 ④: 거래가 1,000건 넘는 주소는 거래소·서비스일 가능성이 커서 멈춤
    if (page.hasMore) return "hub";
    const flows = graphFlows(address, side, page.transfers, prices);
    if (flows.length === 0) return "leaf";
    this.addNeighbors(address, side, hop + 1, flows, limit);
    return "expanded";
  }
}

// 첫 화면 그래프: 시작 주소의 받은·보낸 상대 + 큰 상대 몇 곳은 2단계까지
export async function buildGraph(center: string): Promise<GraphData> {
  const { prices, approx } = await pricesOrFallback();
  const builder = new GraphBuilder();
  const centerAddress = toChecksum(center);
  const centerTag = getTag(center) ?? undefined;
  const centerNode: GraphNode = {
    id: center,
    kind: "center",
    address: centerAddress,
    side: null,
    hop: 0,
    label: shortAddress(centerAddress),
    valueEth: 0,
    state: "expanded",
    ...(centerTag ? { tag: centerTag } : {}),
  };
  builder.nodes.set(center, centerNode);

  const notes: string[] = [];
  const sides: Side[] = ["in", "out"];
  const pages = await Promise.all(sides.map((side) => fetchTransfers(center, side)));
  const sideTotals = { in: 0, out: 0 };
  const flowsBySide: Record<Side, Flow[]> = { in: [], out: [] };

  sides.forEach((side, i) => {
    const page = pages[i];
    if (page.hasMore) {
      notes.push(
        `${side === "in" ? "받은" : "보낸"} 기록이 1,000건이 넘어서 최근 1,000건만 그래프에 썼어요.`,
      );
    }
    const flows = graphFlows(center, side, page.transfers, prices);
    flowsBySide[side] = flows;
    sideTotals[side] = flows.reduce((total, flow) => total + flow.valueEth, 0);
    builder.addNeighbors(center, side, 1, flows, GRAPH.topPerSide);
    // 상위 N개 밖 상대는 그래프에서 빠짐 → 아래 표와 비교할 때 헷갈리지 않게 알려 줌
    const shown = groupFlows(flows)
      .slice(0, GRAPH.topPerSide)
      .reduce((total, item) => total + (item.kind === "bundle" ? item.flows.length : 1), 0);
    if (shown < flows.length) {
      notes.push(
        `${side === "in" ? "받은" : "보낸"} 상대 ${flows.length.toLocaleString("en-US")}곳 중 금액이 큰 ${shown}곳만 그렸어요. 나머지는 아래 송금 기록 표에 있어요.`,
      );
    }
  });
  centerNode.valueEth = Math.max(sideTotals.in, sideTotals.out);

  // 양쪽 다 오간 주소는 금액이 큰 쪽으로. ensureNode의 같은 규칙은 양쪽 상위 N개에 다 들 때만 돌아서
  // (예: Ronin의 USDC 교환 지갑) 자르기 전 전체 금액으로 한 번 더 확인
  for (const node of builder.nodes.values()) {
    if (node.kind !== "address" || node.hop !== 1 || !node.side) continue;
    const other: Side = node.side === "in" ? "out" : "in";
    const flow = flowsBySide[other].find((f) => f.counterparty === node.id);
    if (!flow || flow.valueEth <= node.valueEth) continue;
    node.side = other;
    node.valueEth = flow.valueEth;
    delete node.group;
    builder.addLink(center, node.id, other, linkInfo(flow));
  }

  // 자동으로 2단계까지 펼칠 상대: 양쪽을 다 붙인 뒤에 쪽마다 금액 큰 순 (묶음 꽃잎·아주 작은 상대 제외)
  const autoExpand = sides.flatMap((side) =>
    [...builder.nodes.values()]
      .filter(
        (node) =>
          node.kind === "address" &&
          node.state === "expandable" &&
          node.hop === 1 &&
          node.side === side &&
          !node.group &&
          node.valueEth >= sideTotals[side] * GRAPH.autoExpandMinShare,
      )
      .sort((a, b) => b.valueEth - a.valueEth)
      .slice(0, GRAPH.autoExpandPerSide)
      .map((node) => ({ node, side })),
  );

  // 2단계 자동 펼치기. 하나가 실패해도 나머지는 그림 (실패한 점은 눌러서 다시 시도)
  let failed = 0;
  await Promise.all(
    autoExpand.map(async ({ node, side }) => {
      try {
        node.state = await builder.expand(node.id, side, node.hop, prices, GRAPH.expandTop);
      } catch (error) {
        failed++;
        console.error(`[tracer] expand failed: ${redactKey(String(error))}`);
      }
    }),
  );

  const nodes = [...builder.nodes.values()];
  if (nodes.some((node) => node.state === "terminal")) {
    notes.push(
      "거래소·DEX(초록 육각형)·믹서(보라 세모)에서는 다른 사람 돈과 섞이고, 브릿지(파랑 거꾸로 세모)에서는 다른 블록체인으로 나가서 더 따라갈 수 없어요. 그래서 여기서 멈췄어요.",
    );
  }
  if (nodes.some((node) => node.state === "hub")) {
    notes.push("점선 테두리 점은 거래가 1,000건 넘는 주소예요. 거래소·서비스일 수 있어서 여기서 멈췄어요.");
  }
  if (failed > 0) notes.push(`주소 ${failed}곳은 불러오지 못했어요. 그 점을 누르면 다시 시도해요.`);
  if (approx) notes.push("토큰 시세를 가져오지 못해서 근사값으로 금액을 비교했어요.");

  return { centerId: center, nodes, links: [...builder.links.values()], notes, totals: sideTotals };
}

// 점 하나를 눌렀을 때: 같은 방향으로 한 단계 더
export async function expandNode(address: string, side: Side, hop: number): Promise<ExpandResult> {
  if (address === ZERO_ADDRESS) return { focus: { id: address, state: "leaf" }, nodes: [], links: [] };
  const { prices } = await pricesOrFallback();
  const builder = new GraphBuilder();
  // 기준 주소 자리를 먼저 채워 둬서 새 점으로 다시 만들어지지 않게
  builder.nodes.set(address, {
    id: address,
    kind: "address",
    address: toChecksum(address),
    side,
    hop,
    label: "",
    valueEth: 0,
    state: "expanded",
  });
  const state = await builder.expand(address, side, hop, prices, GRAPH.expandTop);
  builder.nodes.delete(address);
  return {
    focus: { id: address, state },
    nodes: [...builder.nodes.values()],
    links: [...builder.links.values()],
  };
}
