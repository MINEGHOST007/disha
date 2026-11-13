import { NextResponse } from "next/server";
import { projectCashFlow } from "@/lib/engines";
import { apiErrorResponse, readJson, DishaApiError } from "@/lib/disha/http";
import { addDemoBill } from "@/lib/disha/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (typeof body?.total !== "number" || typeof body?.inventoryCost !== "number" || typeof body?.gheeQty !== "number") {
      throw new DishaApiError("Bill total, inventory cost, and ghee quantity are required.", 400);
    }
    const state = await addDemoBill(body.total, body.inventoryCost, body.gheeQty);
    return NextResponse.json({ state, cashFlow: projectCashFlow(30, state.extraBills) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
