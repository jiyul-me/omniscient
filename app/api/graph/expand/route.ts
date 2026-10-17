import type { NextRequest } from "next/server";
import { parseInput } from "@/lib/address";
import { alchemyErrorKind, hasApiKey } from "@/lib/alchemy";
import { GRAPH } from "@/lib/risk-config";
import { expansionKey, loadSnapshot } from "@/lib/snapshots";
import { TRACE_ERRORS } from "@/lib/trace";
import { expandNode } from "@/lib/tracer";

// GET /api/graph/expand?address=0x…&side=out&hop=1 → 그 주소를 같은 방향으로 한 단계 더 펼친 결과
// &demo=<데모 id>를 붙이면 데모 저장본에 있는 결과를 먼저 씀 (없으면 실시간으로)
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = parseInput(params.get("address") ?? "");
  const side = params.get("side");
  const hop = Number(params.get("hop"));
  if (
    parsed.kind !== "address" ||
    (side !== "in" && side !== "out") ||
    !Number.isInteger(hop) ||
    hop < 1 ||
    hop >= GRAPH.maxHop
  ) {
    return Response.json({ error: "format", message: "잘못된 요청이에요." }, { status: 400 });
  }
  const demo = params.get("demo");
  const saved = demo ? loadSnapshot(demo)?.expansions[expansionKey(parsed.address, side, hop)] : null;
  if (saved) return Response.json(saved);
  if (!hasApiKey()) {
    const { status, message } = TRACE_ERRORS["missing-key"];
    return Response.json({ error: "missing-key", message }, { status });
  }
  try {
    return Response.json(await expandNode(parsed.address, side, hop));
  } catch (error) {
    const kind = alchemyErrorKind(error) ?? "upstream";
    const { status, message } = TRACE_ERRORS[kind];
    return Response.json({ error: kind, message }, { status });
  }
}
