import { NextResponse } from "next/server";
import { buildBriefingCards, type BriefingLanguage } from "@/lib/disha/briefing";
import { getDashboardSnapshot } from "@/lib/disha/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const language: BriefingLanguage = new URL(request.url).searchParams.get("language") === "te" ? "te" : "en";
  const snapshot = await getDashboardSnapshot();
  return NextResponse.json({
    cards: buildBriefingCards(snapshot.state, language),
    dataset: snapshot.analytics.dataset,
    storageAvailable: snapshot.storageAvailable,
  }, { headers: { "Cache-Control": "no-store" } });
}
