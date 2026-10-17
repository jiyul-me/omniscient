import "server-only";
import type { Prices } from "./alchemy";
import { transferValueEth } from "./flows";
import type { FlowSummary } from "./graph";
import { getTag } from "./labels";
import { DUST_ETH } from "./risk-config";
import type { TransferHistory } from "./transfers";

const MAX_ITEMS = 5;

// 그래프 옆 '주요 흐름': 라벨 있는 상대와 직접 주고받은 돈을 (방향, 분류)별로 합침. 금액 큰 순 5개까지
// 받은 먼지(0.01 ETH 미만)는 빼고, 비율은 그쪽 전체 금액(먼지 제외) 대비
export function summarizeFlows(history: TransferHistory, prices: Prices): FlowSummary[] {
  const totals = { in: 0, out: 0 };
  const groups = new Map<string, Omit<FlowSummary, "share" | "count"> & { addresses: Set<string> }>();
  for (const transfer of history.transfers) {
    if (transfer.direction === "self" || !transfer.counterparty) continue;
    const side = transfer.direction;
    const value = transferValueEth(transfer.symbol, transfer.amount, prices);
    if (side === "in" && value < DUST_ETH) continue;
    totals[side] += value;
    const tag = getTag(transfer.counterparty);
    if (!tag) continue;
    const key = `${side}:${tag.category}`;
    const group = groups.get(key) ?? { side, category: tag.category, valueEth: 0, addresses: new Set<string>() };
    group.valueEth += value;
    group.addresses.add(transfer.counterparty);
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((group) => group.valueEth > 0)
    .map(({ addresses, ...group }) => ({
      ...group,
      share: totals[group.side] > 0 ? group.valueEth / totals[group.side] : 0,
      count: addresses.size,
    }))
    .sort((a, b) => b.valueEth - a.valueEth)
    .slice(0, MAX_ITEMS);
}
