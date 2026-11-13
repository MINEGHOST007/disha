import { NextResponse } from "next/server";
import { runDemoTool, TOOL_REGISTRY } from "@/lib/agent";
import { apiErrorResponse, readJson, DishaApiError } from "@/lib/disha/http";
import { createProposal, getCurrentDemoState, recordAuditEvent } from "@/lib/disha/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { name: string } }) {
  try {
    const tool = TOOL_REGISTRY.find((entry) => entry.name === params.name);
    if (!tool) throw new DishaApiError("Unknown Disha tool.", 404);

    const body = await readJson(request);
    if (tool.mode === "consequential") {
      if (body?.execute === true) {
        let auditSaved = true;
        try {
          await recordAuditEvent("tool_refused", { tool: tool.name });
        } catch {
          auditSaved = false;
        }
        return NextResponse.json(
          { error: "Merchant approval is required before this action can execute.", auditSaved },
          { status: 403 },
        );
      }

      const type = tool.name === "draft_whatsapp_message"
        ? "message"
        : tool.name === "create_reorder_draft"
          ? "reorder"
          : "stock_update";
      const language = body?.language === "te" ? "te" : "en";
      const qtyChange = typeof body?.qtyChange === "number" ? body.qtyChange : undefined;
      return NextResponse.json(await createProposal(type, language, qtyChange), { status: 201 });
    }

    const state = await getCurrentDemoState();
    const result = runDemoTool(tool.name, { onHand: state.onHand, billRecorded: state.billRecorded, festivalMultiplier: state.festivalMultiplier, extraBills: state.extraBills });
    await recordAuditEvent("tool_ran", { tool: tool.name });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
