import { NextResponse } from "next/server";
import { apiErrorResponse, readJson } from "@/lib/disha/http";
import { rejectProposal } from "@/lib/disha/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson(request);
    const reason = typeof body?.reason === "string" ? body.reason : undefined;
    return NextResponse.json(await rejectProposal(params.id, reason), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
