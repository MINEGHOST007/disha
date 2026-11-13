import { NextResponse } from "next/server";
import { apiErrorResponse, readJson, DishaApiError } from "@/lib/disha/http";
import { listAuditLogs, recordAuditEvent } from "@/lib/disha/store";
import { requireRole } from "@/lib/supabase/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspace = await requireRole();
    return NextResponse.json({ logs: await listAuditLogs(workspace.merchantId) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await requireRole("manager");
    const body = await readJson(request);
    if (body?.event !== "dismiss_reconciliation") {
      throw new DishaApiError("Unsupported audit event.", 400);
    }
    await recordAuditEvent(workspace.merchantId, "dismiss_reconciliation");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
