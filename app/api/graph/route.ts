import type { NextRequest } from "next/server";
import { TRACE_ERRORS, trace } from "@/lib/trace";
import { buildGraph } from "@/lib/tracer";

// GET /api/graph?address=0x… (또는 이름.eth) → 2단계 자금 흐름 그래프 JSON
export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("address") ?? "";
  const result = await trace(input);
  if (!result.ok) {
    const { status, message } = TRACE_ERRORS[result.error];
    return Response.json({ error: result.error, message }, { status });
  }
  try {
    return Response.json(await buildGraph(result.history.address));
  } catch {
    const { status, message } = TRACE_ERRORS.upstream;
    return Response.json({ error: "upstream", message }, { status });
  }
}
