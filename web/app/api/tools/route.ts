import { NextResponse } from "next/server";
import { MERCHANT_DATA_TOOL_NAMES } from "@/lib/merchant/tools";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ tools: MERCHANT_DATA_TOOL_NAMES, mode: "read_only", scope: "authenticated_merchant_workspace" }, {
    headers: { "Cache-Control": "no-store" },
  });
}
