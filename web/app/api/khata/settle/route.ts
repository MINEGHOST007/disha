import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, DishaApiError, readJson } from "@/lib/disha/http";
import { requireRole } from "@/lib/supabase/authz";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ entry_id: z.string().uuid(), amount: z.number().finite().positive().nullable().optional() }).strict();
export async function POST(request: Request) {
  try {
    await requireRole("manager");
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new DishaApiError("Choose an open Khata entry and a valid payment amount.", 400);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("disha_settle_khata", { p_entry: parsed.data.entry_id, p_amount: parsed.data.amount ?? null });
    if (error) throw new DishaApiError("This Khata payment could not be recorded.", error.code === "42501" ? 403 : 400);
    return NextResponse.json({ entry: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
