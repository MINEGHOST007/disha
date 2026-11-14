import { parse } from "csv-parse/sync";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, DishaApiError } from "@/lib/disha/http";
import { validatePurchaseBill, type PurchaseBill } from "@/lib/merchant/purchase-forecast";
import { requireRole } from "@/lib/supabase/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 10 * 1024 * 1024;

const rowSchema = z.object({
  supplier_name: z.string().trim().min(1).max(120),
  bill_number: z.string().trim().min(1).max(80),
  bill_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total_amount: z.coerce.number().finite().min(0).max(1_000_000_000),
  credit_days: z.coerce.number().int().min(0).max(365).optional().default(0),
  item_name: z.string().trim().min(1).max(120),
  quantity: z.coerce.number().finite().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(24),
  unit_price: z.coerce.number().finite().min(0).max(1_000_000_000),
  line_total: z.coerce.number().finite().min(0).max(1_000_000_000),
}).strict();

function dateIsReal(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(request: Request) {
  try {
    await requireRole("manager");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) throw new DishaApiError("Choose a supplier invoices CSV file.", 400);
    if (!file.size || file.size > MAX_BYTES) throw new DishaApiError("Choose a CSV smaller than 10 MB.", 413);

    let rows: Record<string, unknown>[];
    try { rows = parse(await file.text(), { columns: true, skip_empty_lines: true, trim: true, bom: true, max_record_size: 16_384 }); }
    catch { throw new DishaApiError("The CSV could not be read. Download the supplier invoice template and try again.", 400); }
    if (!rows.length || rows.length > 10_000) throw new DishaApiError("The CSV needs between 1 and 10,000 item rows.", 400);

    const groups = new Map<string, PurchaseBill>();
    for (let index = 0; index < rows.length; index += 1) {
      const parsed = rowSchema.safeParse(rows[index]);
      if (!parsed.success || !dateIsReal(parsed.data?.bill_date ?? "")) throw new DishaApiError(`Check CSV row ${index + 2}. Use the template columns and YYYY-MM-DD dates.`, 400);
      const row = parsed.data;
      const key = `${row.supplier_name.toLocaleLowerCase()}\u001f${row.bill_date}\u001f${row.bill_number}`;
      const bill = groups.get(key) ?? { supplier_name: row.supplier_name, bill_number: row.bill_number, bill_date: row.bill_date, total_amount: row.total_amount, credit_days: row.credit_days, items: [] };
      if (bill.total_amount !== row.total_amount || bill.credit_days !== row.credit_days) throw new DishaApiError(`Invoice ${row.bill_number} repeats conflicting totals or credit terms.`, 400);
      bill.items.push({ name: row.item_name, quantity: row.quantity, unit: row.unit, unit_price: row.unit_price, line_total: row.line_total });
      groups.set(key, bill);
    }

    const bills = Array.from(groups.values()).map((bill) => ({ ...bill, source: "csv" as const, source_file_name: file.name, validationErrors: validatePurchaseBill(bill) }));
    return NextResponse.json({ bills, saved: false }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
