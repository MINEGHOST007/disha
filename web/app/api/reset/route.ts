import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/disha/http";
import { resetDemo } from "@/lib/disha/store";
import { projectCashFlow } from "@/lib/engines";
import { requireRole } from "@/lib/supabase/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const workspace = await requireRole("owner");
    const state = await resetDemo(workspace.merchantId);
    return NextResponse.json({ state, logs: [], cashFlow: projectCashFlow(30, state.extraBills) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
