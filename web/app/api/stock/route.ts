import { NextResponse } from "next/server";
import { apiErrorResponse, readJson, DishaApiError } from "@/lib/disha/http";
import { updateDemoStock } from "@/lib/disha/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (typeof body?.onHand !== "number") {
      throw new DishaApiError("Stock count must be a number.", 400);
    }
    const state = await updateDemoStock(body.onHand);
    return NextResponse.json({ state }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
