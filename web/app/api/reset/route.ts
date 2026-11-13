import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/disha/http";
import { resetDemo } from "@/lib/disha/store";
import { projectCashFlow } from "@/lib/engines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const state = await resetDemo();
    return NextResponse.json({ state, logs: [], cashFlow: projectCashFlow(30, state.extraBills) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
