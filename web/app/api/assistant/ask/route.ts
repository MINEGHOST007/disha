import { NextResponse } from "next/server";
import { z } from "zod";
import { answerMerchantQuestion } from "@/lib/merchant/assistant";
import { apiErrorResponse, DishaApiError, readJson } from "@/lib/disha/http";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ question: z.string().trim().min(1).max(600), language: z.enum(["en", "te"]).default("en") }).strict();

export async function POST(request: Request) {
  try {
    const workspace = await requireRole();
    const input = requestSchema.safeParse(await readJson(request));
    if (!input.success) throw new DishaApiError("Enter a short question and choose English or Telugu.", 400);

    const result = await answerMerchantQuestion({ merchantId: workspace.merchantId, ...input.data });
    const supabase = await createClient();
    const { error } = await supabase.rpc("disha_log_agent_query", { p_tools: result.usedTools, p_language: input.data.language });
    if (error) throw new DishaApiError("The answer was prepared, but its audit record could not be saved. Try again.", 503);

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
