import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, DishaApiError, readJson } from "@/lib/disha/http";
import { validatePurchaseBill, type PurchaseBill } from "@/lib/merchant/purchase-forecast";
import { requireRole } from "@/lib/supabase/authz";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const line = z.object({ name: z.string().trim().min(1).max(120), quantity: z.number().finite().positive().max(1_000_000), unit: z.string().trim().min(1).max(24), unit_price: z.number().finite().min(0), line_total: z.number().finite().min(0), sku_id: z.string().uuid().nullable().optional(), pack_size: z.number().finite().positive().nullable().optional() }).strict();
const bill = z.object({ supplier_name: z.string().trim().min(1).max(120), bill_number: z.string().trim().min(1).max(80), bill_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), total_amount: z.number().finite().min(0), credit_days: z.number().int().min(0).max(365).default(0), source: z.enum(["csv","sarvam_vision","openrouter_vision"]).default("csv"), source_file_name: z.string().max(180).optional(), items: z.array(line).min(1).max(200) }).strict();
const inputSchema = z.object({ bills: z.array(bill).min(1).max(50) }).strict();

export async function POST(request: Request) {
  try {
    await requireRole("manager");
    const parsed = inputSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new DishaApiError("Review each invoice and correct missing fields before saving.", 400);
    const invalid = parsed.data.bills.find((value) => validatePurchaseBill(value as PurchaseBill).length);
    if (invalid) throw new DishaApiError(`Invoice ${invalid.bill_number} failed its arithmetic check. Nothing was saved.`, 422);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("disha_import_purchase_bills", { p_bills: parsed.data.bills as unknown as Json });
    if (error) throw new DishaApiError(error.code === "42501" ? "Your workspace role cannot save invoices." : "Invoices could not be saved. Apply the Disha merchant growth migration and retry.", error.code === "42501" ? 403 : 503);
    return NextResponse.json({ saved: data, forecastReady: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
