import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/disha/http";
import { getDashboardSnapshot } from "@/lib/disha/store";
import { requireRole } from "@/lib/supabase/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspace = await requireRole();
    return NextResponse.json(await getDashboardSnapshot(workspace.merchantId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
