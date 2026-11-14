import { NextResponse } from "next/server";
import { z } from "zod";
import { extractSupplierBill } from "@/lib/ai/sarvam-doc-ai";
import { validatePurchaseBill } from "@/lib/merchant/purchase-forecast";
import { apiErrorResponse, DishaApiError } from "@/lib/disha/http";
import { requireRole } from "@/lib/supabase/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 10 * 1024 * 1024;
const line = z.object({ name: z.string().trim().min(1).max(120), quantity: z.coerce.number().finite().positive(), unit: z.string().trim().min(1).max(24), unit_price: z.coerce.number().finite().min(0), line_total: z.coerce.number().finite().min(0) });
const invoice = z.object({ supplier_name: z.string().trim().min(1).max(120), bill_number: z.string().trim().min(1).max(80), bill_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), total_amount: z.coerce.number().finite().min(0), credit_days: z.coerce.number().int().min(0).max(365).optional().default(0), items: z.array(line).min(1).max(200) });

function supportedFile(file: File, bytes: Buffer) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return file.type === "application/pdf" && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (name.endsWith(".png")) return file.type === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return file.type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return false;
}

export async function POST(request: Request) {
  try {
    await requireRole("manager");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new DishaApiError("Choose a supplier invoice photo or PDF.", 400);
    if (!file.size || file.size > MAX_BYTES) throw new DishaApiError("Choose a photo or PDF smaller than 10 MB.", 413);
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!supportedFile(file, bytes)) throw new DishaApiError("Use a valid PNG, JPG, or PDF supplier invoice.", 415);
    let extracted: unknown;
    try { extracted = await extractSupplierBill({ name: file.name.slice(0, 160), mime: file.type, bytes }); }
    catch (cause) { console.error("Supplier invoice OCR failed", cause instanceof Error ? cause.message : "unknown"); throw new DishaApiError("Sarvam could not read this invoice. Try a clearer image or enter it from CSV.", 502); }
    const parsed = invoice.safeParse(extracted);
    if (!parsed.success) throw new DishaApiError("The invoice extraction was incomplete. Add or correct the missing fields in the review step.", 422);
    const bill = { ...parsed.data, source: "sarvam_vision" as const, source_file_name: file.name.slice(0, 180) };
    return NextResponse.json({ bill, validationErrors: validatePurchaseBill(bill), saved: false }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
