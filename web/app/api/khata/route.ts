import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, DishaApiError, readJson } from "@/lib/disha/http";
import { requireRole } from "@/lib/supabase/authz";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ customer_name: z.string().trim().min(1).max(120), amount: z.number().finite().positive().max(100_000_000), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), auto_match: z.boolean().default(false), note: z.string().trim().max(300).nullable().optional() }).strict();

export async function POST(request: Request) {
  try {
    await requireRole("manager");
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new DishaApiError("Enter a name and a valid amount for this Khata entry.", 400);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("disha_create_khata", { p_customer: parsed.data.customer_name, p_amount: parsed.data.amount, p_due: parsed.data.due_date ?? null, p_auto: parsed.data.auto_match, p_note: parsed.data.note ?? null });
    if (error) throw new DishaApiError("Khata entry could not be saved. Apply the Disha merchant growth migration and retry.", error.code === "42501" ? 403 : 503);
    return NextResponse.json({ id: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
