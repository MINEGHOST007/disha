import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/disha/http";
import { buildBriefingCards, type BriefingLanguage } from "@/lib/disha/briefing";
import { getDashboardSnapshot } from "@/lib/disha/store";
import { requireRole } from "@/lib/supabase/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const language: BriefingLanguage = new URL(request.url).searchParams.get("language") === "te" ? "te" : "en";
    const workspace = await requireRole();
    const snapshot = await getDashboardSnapshot(workspace.merchantId);
    return NextResponse.json({
      cards: buildBriefingCards(snapshot.state, language),
      dataset: snapshot.analytics.dataset,
      storageAvailable: snapshot.storageAvailable,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
