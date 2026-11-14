import { parse } from "csv-parse/sync";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, DishaApiError } from "@/lib/disha/http";
import { requireRole } from "@/lib/supabase/authz";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const row = z.object({ external_id: z.string().trim().min(1).max(160), occurred_at: z.string().datetime({ offset: true }), customer_name: z.string().trim().min(1).max(120), amount: z.coerce.number().finite().positive().max(1_000_000_000), mode: z.string().trim().min(1).max(40), status: z.enum(["success","failed","pending"]) }).strict();

export async function POST(request: Request) {
  try {
    await requireRole("manager");
    if (Number(request.headers.get("content-length") ?? 0) > 5 * 1024 * 1024) throw new DishaApiError("Choose a transaction CSV smaller than 5 MB.", 413);
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) throw new DishaApiError("Choose a transaction CSV file.", 400);
    if (!file.size || file.size > 5 * 1024 * 1024) throw new DishaApiError("Choose a transaction CSV smaller than 5 MB.", 413);
    let source: Record<string, unknown>[];
    try { source = parse(await file.text(), { columns: true, skip_empty_lines: true, trim: true, bom: true, max_record_size: 16_384 }); }
    catch { throw new DishaApiError("The CSV could not be parsed. Check the transaction template headers.", 400); }
    if (!source.length || source.length > 10_000) throw new DishaApiError("Import between 1 and 10,000 transaction rows.", 400);
    const rows: z.infer<typeof row>[] = [];
    for (let i = 0; i < source.length; i += 1) {
      const result = row.safeParse(source[i]);
      if (!result.success) throw new DishaApiError(`Check transaction CSV row ${i + 2}; the required columns are transaction_id, occurred_at, customer_name, amount, mode, status.`, 400);
      rows.push(result.data);
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("disha_import_transactions", { p_rows: rows as unknown as Json });
    if (error) throw new DishaApiError("Transactions could not be saved. Apply the Disha merchant growth migration and retry.", error.code === "42501" ? 403 : 503);
    return NextResponse.json({ imported: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
