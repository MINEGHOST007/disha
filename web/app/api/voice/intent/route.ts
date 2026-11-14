import { NextResponse } from "next/server";
import { answerMerchantQuestion } from "@/lib/merchant/assistant";
import { apiErrorResponse, DishaApiError, readJson } from "@/lib/disha/http";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const workspace = await requireRole();
    const body = await readJson(request);
    const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
    const language = body?.language === "te" ? "te" : "en";
    if (!transcript || transcript.length > 600) throw new DishaApiError("Enter a short voice or typed request.", 400);

    const result = await answerMerchantQuestion({ merchantId: workspace.merchantId, question: transcript, language });
    const supabase = await createClient();
    const { error } = await supabase.rpc("disha_log_agent_query", { p_tools: result.usedTools, p_language: language });
    if (error) throw new DishaApiError("The answer was prepared, but its audit record could not be saved. Try again.", 503);
    return NextResponse.json({ ...result, proposal: null, storageAvailable: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
