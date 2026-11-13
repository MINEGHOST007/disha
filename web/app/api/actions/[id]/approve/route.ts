import { NextResponse } from "next/server";
import { apiErrorResponse, readJson } from "@/lib/disha/http";
import { approveProposal } from "@/lib/disha/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson(request);
    const language = body?.language === "te" ? "te" : "en";
    const messageText = typeof body?.messageText === "string" ? body.messageText : undefined;
    const proposal = await approveProposal(params.id, language, messageText);
    return NextResponse.json(proposal, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
