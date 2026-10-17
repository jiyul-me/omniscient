import "server-only";
import { parseInput } from "./address";
import {
  alchemyErrorKind,
  hasApiKey,
  redactKey,
  resolveEnsName,
  type AlchemyErrorKind,
} from "./alchemy";
import { getTransferHistory, type TransferHistory } from "./transfers";

export type TraceErrorKind =
  | "format"
  | "checksum"
  | "ens-not-found"
  | "ens-offchain"
  | AlchemyErrorKind;

export const TRACE_ERRORS: Record<
  TraceErrorKind,
  { status: number; message: string }
> = {
  format: {
    status: 400,
    message: "0x로 시작하는 42글자 이더리움 주소나 .eth 이름을 넣어 주세요.",
  },
  checksum: {
    status: 400,
    message:
      "대·소문자가 섞인 주소인데 체크섬(오타 검사)이 맞지 않아요. 복사하다 글자가 바뀌었을 수 있어요.",
  },
  "ens-not-found": {
    status: 404,
    message: "이 .eth 이름에 연결된 주소를 찾지 못했어요.",
  },
  "ens-offchain": {
    status: 422,
    message:
      "외부 서버를 거쳐 연결되는 이름(예: ○○.base.eth)은 아직 지원하지 않아요. 0x 주소로 넣어 주세요.",
  },
  "missing-key": {
    status: 500,
    message: "서버에 Alchemy API 키가 설정되지 않았어요.",
  },
  unauthorized: {
    status: 502,
    message: "서버의 Alchemy API 키가 올바르지 않아요.",
  },
  "rate-limited": {
    status: 429,
    message: "요청이 많아서 잠시 막혔어요. 1분쯤 뒤에 다시 시도해 주세요.",
  },
  upstream: {
    status: 502,
    message: "블록체인 데이터를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.",
  },
};

export type TraceResult =
  | { ok: true; ensName: string | null; history: TransferHistory }
  | { ok: false; error: TraceErrorKind };

// 페이지와 /api/trace가 함께 쓰는 입구: 입력 검사 → (ENS 해석) → 송금 기록
export async function trace(input: string): Promise<TraceResult> {
  const parsed = parseInput(input);
  if (parsed.kind === "invalid") return { ok: false, error: parsed.reason };
  // 키 확인은 캐시 함수 밖에서 (Vercel 환경 변수를 빠뜨린 경우를 정확히 알리려고)
  if (!hasApiKey()) return { ok: false, error: "missing-key" };

  try {
    let address = parsed.kind === "address" ? parsed.address : null;
    let ensName: string | null = null;
    if (parsed.kind === "ens") {
      ensName = parsed.name.toLowerCase();
      const ens = await resolveEnsName(ensName);
      if (ens.offchain) return { ok: false, error: "ens-offchain" };
      if (!ens.address) return { ok: false, error: "ens-not-found" };
      address = ens.address;
    }
    const history = await getTransferHistory(address!);
    return { ok: true, ensName, history };
  } catch (error) {
    const kind = alchemyErrorKind(error) ?? "upstream";
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[trace] ${kind}: ${redactKey(detail)}`);
    return { ok: false, error: kind };
  }
}
