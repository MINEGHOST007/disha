import { NextResponse } from "next/server";
import { TOOL_REGISTRY } from "@/lib/agent";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(TOOL_REGISTRY, {
    headers: { "Cache-Control": "no-store" },
  });
}
