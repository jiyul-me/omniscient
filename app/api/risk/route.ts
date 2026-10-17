import type { NextRequest } from "next/server";
import { redactKey } from "@/lib/alchemy";
import { analyzeRisk } from "@/lib/exposure";
import { TRACE_ERRORS, trace } from "@/lib/trace";

// GET /api/risk?address=0x… (또는 이름.eth) → 0~100 위험 점수 + 이유
// 개발 서버에서만 &debug=1을 붙이면 계산에 쓴 입력(input)도 같이 줌 → 단위 테스트 자료(lib/__fixtures__) 만들 때
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const result = await trace(params.get("address") ?? "");
  if (!result.ok) {
    const { status, message } = TRACE_ERRORS[result.error];
    return Response.json({ error: result.error, message }, { status });
  }
  try {
    const { report, input } = await analyzeRisk(result.history.address);
    const debug = process.env.NODE_ENV === "development" && params.get("debug") === "1";
    return Response.json(debug ? { ...report, input } : report);
  } catch (error) {
    console.error(`[risk] failed: ${redactKey(String(error))}`);
    const { status, message } = TRACE_ERRORS.upstream;
    return Response.json({ error: "upstream", message }, { status });
  }
}
