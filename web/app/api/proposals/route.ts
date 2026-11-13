import { NextResponse } from "next/server";
import { apiErrorResponse, readJson, DishaApiError } from "@/lib/disha/http";
import { createProposal, listProposals } from "@/lib/disha/store";
import type { ProposalType } from "@/lib/disha/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const proposalTypes = new Set<ProposalType>([
  "billing_correction",
  "message",
  "reorder",
  "stock_update",
]);

export async function GET() {
  try {
    return NextResponse.json({ proposals: await listProposals() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (!body || typeof body !== "object" || !proposalTypes.has(body.type)) {
      throw new DishaApiError("Choose a supported sandbox action.", 400);
    }
    const language = body.language === "te" ? "te" : "en";
    const qtyChange = typeof body.qtyChange === "number" ? body.qtyChange : undefined;
    const proposal = await createProposal(body.type, language, qtyChange);
    return NextResponse.json(proposal, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
