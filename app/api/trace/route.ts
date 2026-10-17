import type { NextRequest } from "next/server";
import { pricesOrFallback } from "@/lib/flows";
import { TRACE_ERRORS, trace } from "@/lib/trace";

// GET /api/trace?address=0x… (또는 이름.eth) → 송금 기록 JSON
export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("address") ?? "";
  const [result, { prices, approx }] = await Promise.all([trace(input), pricesOrFallback()]);

  if (!result.ok) {
    const { status, message } = TRACE_ERRORS[result.error];
    return Response.json({ error: result.error, message }, { status });
  }
  // prices = 토큰 금액을 ETH로 비교할 때 쓴 시세 (데모 저장본이 표 정렬·주요 흐름에 같은 시세를 쓰게)
  return Response.json({ ensName: result.ensName, prices: approx ? null : prices, ...result.history });
}
