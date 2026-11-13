import { NextResponse } from "next/server";
import { apiErrorResponse, readJson, DishaApiError } from "@/lib/disha/http";
import { updateDemoState } from "@/lib/disha/store";
import { requireRole } from "@/lib/supabase/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const workspace = await requireRole("manager");
    const body = await readJson(request);
    if (typeof body?.onHand !== "number" && typeof body?.festivalMultiplier !== "number") {
      throw new DishaApiError("A stock count or festival multiplier is required.", 400);
    }
    if (body?.action !== undefined && body.action !== "stock" && body.action !== "festival") {
      throw new DishaApiError("Unsupported demo update.", 400);
    }
    const patch = {
      ...(typeof body.onHand === "number" ? { onHand: body.onHand } : {}),
      ...(typeof body.festivalMultiplier === "number" ? { festivalMultiplier: body.festivalMultiplier } : {}),
    };
    const state = await updateDemoState(workspace.merchantId, patch, body.action === "festival" ? "festival_multiplier" : "demo_stock_editor");
    return NextResponse.json({ state }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
