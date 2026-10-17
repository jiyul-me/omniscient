import "server-only";
import { cacheLife } from "next/cache";
import {
  BaseError,
  ContractFunctionRevertedError,
  HttpRequestError,
  createPublicClient,
  http,
} from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import { TOKENS } from "./tokens";

// Alchemy 호출은 전부 여기서. API 키는 서버에만 (NEXT_PUBLIC_ 금지)
const MAX_CONCURRENT = 2;
const MAX_RETRIES = 4;
const TIMEOUT_MS = 20_000;

const ERROR_KINDS = [
  "missing-key",
  "unauthorized",
  "rate-limited",
  "upstream",
] as const;

export type AlchemyErrorKind = (typeof ERROR_KINDS)[number];

function isErrorKind(value: unknown): value is AlchemyErrorKind {
  return ERROR_KINDS.includes(value as AlchemyErrorKind);
}

export class AlchemyError extends Error {
  // 'use cache' 경계(React Flight)를 지나면 kind 같은 속성은 사라지고 digest만 남음
  readonly digest: string;

  constructor(
    readonly kind: AlchemyErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "AlchemyError";
    this.digest = `ALCHEMY_${kind}`;
  }
}

export function alchemyErrorKind(error: unknown): AlchemyErrorKind | null {
  if (typeof error !== "object" || error === null) return null;
  const { kind, digest } = error as { kind?: unknown; digest?: unknown };
  if (isErrorKind(kind)) return kind;
  if (typeof digest === "string" && digest.startsWith("ALCHEMY_")) {
    const fromDigest = digest.slice("ALCHEMY_".length);
    if (isErrorKind(fromDigest)) return fromDigest;
  }
  return null;
}

export function hasApiKey() {
  return Boolean(process.env.ALCHEMY_API_KEY?.trim());
}

// 로그에 남기기 전에 키를 가림
export function redactKey(text: string) {
  const key = process.env.ALCHEMY_API_KEY?.trim();
  return key ? text.replaceAll(key, "***") : text;
}

function rpcUrl() {
  const key = process.env.ALCHEMY_API_KEY?.trim();
  if (!key) {
    throw new AlchemyError("missing-key", "ALCHEMY_API_KEY is not set");
  }
  return `https://eth-mainnet.g.alchemy.com/v2/${key}`;
}

// 동시 호출 제한: 자리가 나면 대기 중인 다음 호출에 자리를 바로 넘겨줌
let active = 0;
const waiting: (() => void)[] = [];

async function acquire() {
  if (active < MAX_CONCURRENT) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
}

function release() {
  const next = waiting.shift();
  if (next) next();
  else active--;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 429·5xx면 1초, 2초, 4초, 8초… 점점 길게 기다렸다 재시도 (지수 백오프)
function backoffMs(attempt: number, retryAfter: string | null) {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return 1000 * 2 ** attempt + Math.floor(Math.random() * 250);
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const url = rpcUrl();
  for (let attempt = 0; ; attempt++) {
    await acquire();
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      // 네트워크 오류 메시지에 키가 든 URL이 섞일 수 있어서 원문은 버림
      release();
      if (attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt, null));
        continue;
      }
      throw new AlchemyError("upstream", `${method}: network error`);
    }
    release();

    if (response.status === 401 || response.status === 403) {
      throw new AlchemyError("unauthorized", `${method}: HTTP ${response.status}`);
    }

    const body = (await response.json().catch(() => null)) as {
      result?: T;
      error?: { code?: number; message?: string };
    } | null;
    const rateLimited = response.status === 429 || body?.error?.code === 429;

    if (rateLimited || response.status >= 500) {
      if (attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt, response.headers.get("retry-after")));
        continue;
      }
      throw new AlchemyError(
        rateLimited ? "rate-limited" : "upstream",
        `${method}: HTTP ${response.status}`,
      );
    }
    if (!response.ok || !body || body.error || body.result === undefined) {
      throw new AlchemyError(
        "upstream",
        `${method}: ${body?.error?.message ?? `HTTP ${response.status}`}`,
      );
    }
    return body.result;
  }
}

export type RawTransfer = {
  uniqueId: string;
  hash: string;
  blockNum: string;
  from: string;
  to: string | null;
  category: "external" | "internal" | "erc20";
  asset: string | null;
  rawContract: {
    value: string | null;
    address: string | null;
    decimal: string | null;
  };
  metadata: { blockTimestamp: string };
};

export type TransferPage = { transfers: RawTransfer[]; hasMore: boolean };

// 주소 하나의 '보낸 기록'(out) 또는 '받은 기록'(in) 최신 1,000건.
// fromAddress와 toAddress를 한 번에 넣으면 AND가 돼서 꼭 따로 호출
async function fetchTransfersCached(
  address: string,
  direction: "in" | "out",
): Promise<TransferPage> {
  "use cache";
  cacheLife("hours");

  const result = await rpc<{ transfers: RawTransfer[]; pageKey?: string }>(
    "alchemy_getAssetTransfers",
    [
      {
        fromBlock: "0x0",
        toBlock: "latest",
        [direction === "out" ? "fromAddress" : "toAddress"]: address,
        // internal 필수: Bybit·Tornado 흐름은 컨트랙트 내부 송금
        category: ["external", "internal", "erc20"],
        // 토큰은 화이트리스트만 받음. 가짜 토큰이 1,000건 한도를 채우지 않게
        // (external·internal ETH 기록에는 영향 없음, 2026-10-16 실측)
        contractAddresses: Object.keys(TOKENS),
        withMetadata: true,
        excludeZeroValue: true,
        maxCount: "0x3e8",
        order: "desc",
      },
    ],
  );
  return { transfers: result.transfers, hasMore: Boolean(result.pageKey) };
}

// 그래프와 위험 점수가 같은 주소를 동시에 부르면 Alchemy 호출은 한 번만 (진행 중인 요청을 같이 기다림).
// 'use cache'가 동시 호출을 합쳐 준다는 보장은 문서에 없음. 캐시 함수 밖의 Map이라 캐시된 코드가
// 이 Promise를 기다리는 일은 없음 (Next 문서 use-cache.md 'Shared deduplication storage')
const inflight = new Map<string, Promise<TransferPage>>();

export function fetchTransfers(address: string, direction: "in" | "out"): Promise<TransferPage> {
  const key = `${address.toLowerCase()}:${direction}`;
  let pending = inflight.get(key);
  if (!pending) {
    pending = fetchTransfersCached(address, direction).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}

// OffchainLookup 오류 = 외부 게이트웨이(CCIP-Read)가 필요한 이름 (예: ○○.base.eth)
const OFFCHAIN_LOOKUP = "0x556f1830";

export type EnsResult = { address: string | null; offchain: boolean };

// xxx.eth → 주소(소문자). 연결된 주소가 없으면 address: null
export async function resolveEnsName(name: string): Promise<EnsResult> {
  "use cache";
  cacheLife("days");

  let normalized: string;
  try {
    normalized = normalize(name);
  } catch {
    return { address: null, offchain: false }; // ENS 규칙에 안 맞는 이름
  }
  const client = createPublicClient({
    chain: mainnet,
    // 429면 1초, 2초 기다렸다 재시도 (rpc()의 지수 백오프와 맞춤)
    transport: http(rpcUrl(), { retryCount: 2, retryDelay: 1000 }),
    // 외부 게이트웨이 호출은 막음
    ccipRead: false,
  });

  await acquire(); // 송금 기록 호출과 같은 '동시 2개' 자리를 씀
  try {
    const address = await client.getEnsAddress({ name: normalized });
    return { address: address ? address.toLowerCase() : null, offchain: false };
  } catch (error) {
    if (error instanceof BaseError) {
      const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
      if (
        reverted instanceof ContractFunctionRevertedError &&
        reverted.signature === OFFCHAIN_LOOKUP
      ) {
        return { address: null, offchain: true };
      }
      const httpError = error.walk((e) => e instanceof HttpRequestError);
      const status =
        httpError instanceof HttpRequestError ? httpError.status : undefined;
      if (status === 401 || status === 403) {
        throw new AlchemyError("unauthorized", "ENS lookup unauthorized");
      }
      if (status === 429) {
        throw new AlchemyError("rate-limited", "ENS lookup rate-limited");
      }
    }
    // viem 오류 메시지엔 키가 든 RPC URL이 들어 있어서 그대로 던지지 않음
    throw new AlchemyError("upstream", "ENS lookup failed");
  } finally {
    release();
  }
}

export type Prices = { ethUsd: number; btcUsd: number };

// ETH·BTC 달러 시세 (Alchemy Prices API). 토큰 금액을 ETH로 바꿔 비교할 때만 씀
async function fetchPricesCached(): Promise<Prices> {
  "use cache";
  cacheLife("hours");

  const key = process.env.ALCHEMY_API_KEY?.trim();
  if (!key) throw new AlchemyError("missing-key", "ALCHEMY_API_KEY is not set");
  await acquire();
  try {
    const response = await fetch(
      `https://api.g.alchemy.com/prices/v1/${key}/tokens/by-symbol?symbols=ETH&symbols=BTC`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    ).catch(() => null);
    const body = (await response?.json().catch(() => null)) as {
      data?: { symbol: string; prices?: { currency: string; value: string }[] }[];
    } | null;
    const usd = (symbol: string) =>
      Number(
        body?.data
          ?.find((d) => d.symbol === symbol)
          ?.prices?.find((p) => p.currency === "usd")?.value,
      );
    const prices = { ethUsd: usd("ETH"), btcUsd: usd("BTC") };
    if (!(prices.ethUsd > 0 && prices.btcUsd > 0)) {
      throw new AlchemyError("upstream", `prices: HTTP ${response?.status ?? "network"}`);
    }
    return prices;
  } finally {
    release();
  }
}

// 실패하면 null (오류는 캐시하지 않으려고 캐시 함수 밖에서 잡음). 실패하면 1분 동안은 다시 부르지 않음
let pricesFailedAt = -Infinity; // performance.now() 기준 (Date.now()는 Cache Components가 막음)
export async function fetchPrices(): Promise<Prices | null> {
  if (performance.now() - pricesFailedAt < 60_000) return null;
  try {
    return await fetchPricesCached();
  } catch {
    pricesFailedAt = performance.now();
    return null;
  }
}
