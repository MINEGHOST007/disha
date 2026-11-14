import { parse } from "csv-parse/sync";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiErrorResponse, DishaApiError } from "@/lib/disha/http";
import { requireRole } from "@/lib/supabase/authz";
import type { Json } from "@/lib/supabase/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const rowSchema = z.object({
  bill_number: z.string().trim().min(1).max(80),
  bill_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total_amount: z.coerce.number().finite().min(0).max(1_000_000_000),
  customer_name: z.string().trim().max(120).optional().default(""),
  payment_mode: z.string().trim().max(40).optional().default(""),
  item_name: z.string().trim().min(1).max(120),
  quantity: z.coerce.number().finite().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(24),
  unit_price: z.coerce.number().finite().min(0).max(1_000_000_000),
  line_total: z.coerce.number().finite().min(0).max(1_000_000_000),
}).strict();

type BillGroup = {
  bill_number: string;
  bill_date: string;
  customer_name: string;
  total_amount: number;
  payment_mode: string;
  items: { name: string; quantity: number; unit: string; unit_price: number; line_total: number }[];
};

function validDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function POST(request: Request) {
  try {
    await requireRole("manager");
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_CSV_BYTES + 64 * 1024) throw new DishaApiError("Choose a CSV file smaller than 5 MB.", 413);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLocaleLowerCase().endsWith(".csv")) throw new DishaApiError("Choose a bills CSV file.", 400);
    if (file.size === 0 || file.size > MAX_CSV_BYTES) throw new DishaApiError("Choose a CSV file smaller than 5 MB.", 413);

    let rawRows: Record<string, unknown>[];
    try {
      rawRows = parse(await file.text(), { columns: true, skip_empty_lines: true, trim: true, bom: true, max_record_size: 16_384 });
    } catch {
      throw new DishaApiError("The CSV could not be read. Download the template and try again.", 400);
    }
    if (!rawRows.length || rawRows.length > 10_000) throw new DishaApiError("The CSV must contain between 1 and 10,000 item rows.", 400);

    const groups = new Map<string, BillGroup>();
    for (let index = 0; index < rawRows.length; index += 1) {
      const raw = rawRows[index];
      const parsed = rowSchema.safeParse(raw);
      if (!parsed.success || !validDate(parsed.data?.bill_date ?? "")) throw new DishaApiError(`Check CSV row ${index + 2}. Dates must use YYYY-MM-DD and every bill line needs a product, quantity, and price.`, 400);
      const row = parsed.data;
      const key = `${row.bill_date}\u001f${row.bill_number}`;
      const group = groups.get(key) ?? {
        bill_number: row.bill_number,
        bill_date: row.bill_date,
        customer_name: row.customer_name,
        total_amount: row.total_amount,
        payment_mode: row.payment_mode,
        items: [],
      };
      if (group.total_amount !== row.total_amount || group.customer_name !== row.customer_name || group.payment_mode !== row.payment_mode) {
        throw new DishaApiError(`Bill ${row.bill_number} has conflicting header values across its CSV rows.`, 400);
      }
      group.items.push({ name: row.item_name, quantity: row.quantity, unit: row.unit, unit_price: row.unit_price, line_total: row.line_total });
      groups.set(key, group);
    }
    if (groups.size > 5000) throw new DishaApiError("Import no more than 5,000 bills at a time.", 413);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("disha_import_store_bills", { p_bills: Array.from(groups.values()) as Json });
    if (error) throw new DishaApiError("Bills could not be saved. Apply the live merchant data migration and try again.", error.code === "42501" ? 403 : 503);
    return NextResponse.json({ imported: data, bill_count: groups.size, item_rows: rawRows.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
