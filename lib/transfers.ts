import "server-only";
import { formatUnits } from "viem";
import { fetchTransfers, type RawTransfer, type TransferPage } from "./alchemy";
import { ETH, tokenOf } from "./tokens";

// 화면·JSON으로 보내는 송금 한 건. BigInt는 전부 문자열로 바꿔 둠
export type Transfer = {
  id: string;
  hash: string;
  timestamp: string;
  direction: "in" | "out" | "self";
  counterparty: string | null; // 소문자. null = 컨트랙트 생성
  category: RawTransfer["category"];
  symbol: string;
  amount: string; // formatUnits 결과 (예: "10000.5")
};

export type TransferHistory = {
  address: string; // 소문자
  transfers: Transfer[]; // 최신순, 화이트리스트 토큰만
  // 1,000건이 넘어서 잘렸으면 가져온 기록 중 가장 오래된 시각 (그 이전은 빠짐). 안 잘렸으면 null
  truncatedBefore: { in: string | null; out: string | null };
  ethTotals: { in: string; out: string };
};


// Alchemy는 최신순으로 주니까 마지막 기록이 가장 오래된 것
function oldestIfTruncated(page: TransferPage) {
  return page.hasMore ? (page.transfers.at(-1)?.metadata.blockTimestamp ?? null) : null;
}

// address는 소문자로 받음 (lib/address.ts parseInput 결과)
export async function getTransferHistory(
  address: string,
): Promise<TransferHistory> {
  const [incoming, outgoing] = await Promise.all([
    fetchTransfers(address, "in"),
    fetchTransfers(address, "out"),
  ]);

  // 자기 자신에게 보낸 송금은 양쪽에 다 나옴 → uniqueId로 중복 제거
  const unique = new Map<string, RawTransfer>();
  for (const raw of [...incoming.transfers, ...outgoing.transfers]) {
    unique.set(raw.uniqueId, raw);
  }

  const transfers: Transfer[] = [];
  let ethIn = 0n;
  let ethOut = 0n;

  const sorted = [...unique.values()].sort(
    (a, b) => Number.parseInt(b.blockNum, 16) - Number.parseInt(a.blockNum, 16),
  );
  for (const raw of sorted) {
    const token = tokenOf(raw.category, raw.rawContract.address);
    if (!token) continue; // 요청 때 이미 걸렀지만 한 번 더
    const from = raw.from.toLowerCase();
    const to = raw.to?.toLowerCase() ?? null;
    const direction =
      from === address && to === address ? "self" : from === address ? "out" : "in";
    const value = BigInt(raw.rawContract.value ?? "0x0");

    if (token === ETH) {
      if (direction === "in") ethIn += value;
      if (direction === "out") ethOut += value;
    }
    transfers.push({
      id: raw.uniqueId,
      hash: raw.hash,
      timestamp: raw.metadata.blockTimestamp,
      direction,
      counterparty: direction === "out" ? to : direction === "in" ? from : address,
      category: raw.category,
      symbol: token.symbol,
      amount: formatUnits(value, token.decimals),
    });
  }

  return {
    address,
    transfers,
    truncatedBefore: {
      in: oldestIfTruncated(incoming),
      out: oldestIfTruncated(outgoing),
    },
    ethTotals: {
      in: formatUnits(ethIn, ETH.decimals),
      out: formatUnits(ethOut, ETH.decimals),
    },
  };
}
