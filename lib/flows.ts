import "server-only";
import { formatUnits } from "viem";
import { fetchPrices, type Prices, type RawTransfer } from "./alchemy";
import type { Side } from "./graph";
import { ETH, TOKENS, tokenOf, type TokenInfo } from "./tokens";

// 그래프(lib/tracer.ts)와 위험 점수(lib/exposure.ts)가 같이 쓰는 '상대별 송금 합계'

// 0x000…000 = 토큰 소각(보냄)·발행(받음) 자리. 진짜 상대가 아니고 거래가 수백만 건이라 따라가지 않음
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// 시세를 못 가져오면 쓰는 근사값 (2026-10-16 Alchemy 시세)
export const FALLBACK_PRICES: Prices = { ethUsd: 2440, btcUsd: 82000 };

export async function pricesOrFallback() {
  const prices = await fetchPrices();
  return { prices: prices ?? FALLBACK_PRICES, approx: !prices };
}

function ethRate(token: TokenInfo, prices: Prices) {
  if (token.peg === "eth") return 1;
  if (token.peg === "usd") return 1 / prices.ethUsd;
  return prices.btcUsd / prices.ethUsd;
}

// 송금 한 건의 ETH 환산값 (표의 '주요 거래' 고르기·금액순 정렬·받은 먼지 거르기용)
const PEG_BY_SYMBOL = new Map([ETH, ...Object.values(TOKENS)].map((token) => [token.symbol, token]));
export function transferValueEth(symbol: string, amount: string, prices: Prices) {
  const token = PEG_BY_SYMBOL.get(symbol);
  return token ? Number(amount) * ethRate(token, prices) : 0;
}

export type TokenSum = { token: TokenInfo; raw: bigint; valueEth: number };

// 기준 주소와 상대 주소 하나 사이에 한 방향으로 오간 돈 (토큰별 합계)
export type Flow = {
  counterparty: string; // 소문자
  sums: TokenSum[];
  count: number;
  valueEth: number;
  firstBlock: number; // 이 상대와 처음·마지막으로 오간 블록 (2단계 점수에서 시간 순서 확인용)
  lastBlock: number;
  firstAt: number; // 처음·마지막으로 오간 시각 (밀리초, 그래프 시간 슬라이더용)
  lastAt: number;
};

export function blockOf(transfer: RawTransfer) {
  return Number.parseInt(transfer.blockNum, 16);
}

// 상대별 합계 (금액 큰 순). 먼지도 그대로 둠 → 그래프는 먼지를 빼고, 점수는 보낸 먼지도 셈
export function aggregate(
  focal: string,
  side: Side,
  transfers: RawTransfer[],
  prices: Prices,
): Flow[] {
  const flows = new Map<
    string,
    {
      sums: Map<string, TokenSum>;
      count: number;
      firstBlock: number;
      lastBlock: number;
      firstAt: number;
      lastAt: number;
    }
  >();
  for (const raw of transfers) {
    const token = tokenOf(raw.category, raw.rawContract.address);
    if (!token) continue;
    const other = (side === "out" ? raw.to : raw.from)?.toLowerCase();
    if (!other || other === focal) continue;
    const block = blockOf(raw);
    const at = Date.parse(raw.metadata.blockTimestamp);
    const flow = flows.get(other) ?? {
      sums: new Map(),
      count: 0,
      firstBlock: block,
      lastBlock: block,
      firstAt: at,
      lastAt: at,
    };
    const sum = flow.sums.get(token.symbol) ?? { token, raw: 0n, valueEth: 0 };
    sum.raw += BigInt(raw.rawContract.value ?? "0x0");
    flow.sums.set(token.symbol, sum);
    flow.count++;
    flow.firstBlock = Math.min(flow.firstBlock, block);
    flow.lastBlock = Math.max(flow.lastBlock, block);
    flow.firstAt = Math.min(flow.firstAt, at);
    flow.lastAt = Math.max(flow.lastAt, at);
    flows.set(other, flow);
  }

  const result: Flow[] = [];
  for (const [counterparty, flow] of flows) {
    const sums = [...flow.sums.values()];
    for (const sum of sums) {
      sum.valueEth = Number(formatUnits(sum.raw, sum.token.decimals)) * ethRate(sum.token, prices);
    }
    sums.sort((a, b) => b.valueEth - a.valueEth);
    const valueEth = sums.reduce((total, sum) => total + sum.valueEth, 0);
    result.push({
      counterparty,
      sums,
      count: flow.count,
      valueEth,
      firstBlock: flow.firstBlock,
      lastBlock: flow.lastBlock,
      firstAt: flow.firstAt,
      lastAt: flow.lastAt,
    });
  }
  return result.sort((a, b) => b.valueEth - a.valueEth);
}

// 비슷한 금액 = 토큰 1종 + 유효숫자 3자리가 같음 (예: 10,000 ETH × 40). 그래프 꽃잎 묶음과 점수 2단계 묶음이 같이 씀
export function bundleKey(flow: Flow) {
  if (flow.sums.length !== 1) return null;
  const [{ token, raw }] = flow.sums;
  return `${token.symbol}:${Number(formatUnits(raw, token.decimals)).toPrecision(3)}`;
}
