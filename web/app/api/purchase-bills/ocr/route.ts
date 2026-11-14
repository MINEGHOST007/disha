import { NextResponse } from "next/server";
import { extractSupplierBill } from "@/lib/ai/sarvam-doc-ai";
import { validatePurchaseBill } from "@/lib/merchant/purchase-forecast";
import { apiErrorResponse, DishaApiError } from "@/lib/disha/http";
import { requireRole } from "@/lib/supabase/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const MAX_BYTES = 10 * 1024 * 1024;

// Browsers report invoice MIME types inconsistently ("image/jpg", "", "application/octet-stream"), so trust the file signature.
function detectMime(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

const text = (value: unknown, max: number) => (typeof value === "string" || typeof value === "number" ? String(value).trim().slice(0, max) : "");
function amount(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value !== "string") return NaN;
  const cleaned = value.replace(/[₹,\s]|rs\.?|inr/gi, "");
  return cleaned ? Number(cleaned) : NaN;
}
const money = (value: number) => Math.round(value * 100) / 100;

function isoDate(value: unknown) {
  const raw = text(value, 40);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const indian = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (indian) {
    const year = indian[3].length === 2 ? `20${indian[3]}` : indian[3];
    return `${year}-${indian[2].padStart(2, "0")}-${indian[1].padStart(2, "0")}`;
  }
  return raw;
}

// Turn a possibly incomplete extraction into an editable draft; validatePurchaseBill reports what the merchant still has to fix.
function toDraftBill(extracted: unknown) {
  const source = (extracted && typeof extracted === "object" ? extracted : {}) as Record<string, unknown>;
  const items = (Array.isArray(source.items) ? source.items : []).slice(0, 200).flatMap((entry) => {
    const line = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const name = text(line.name, 120);
    let quantity = amount(line.quantity);
    let unitPrice = amount(line.unit_price);
    let lineTotal = amount(line.line_total);
    if (!name && !Number.isFinite(lineTotal)) return [];
    if (!Number.isFinite(lineTotal) && Number.isFinite(quantity) && Number.isFinite(unitPrice)) lineTotal = money(quantity * unitPrice);
    if (!Number.isFinite(unitPrice) && Number.isFinite(lineTotal) && quantity > 0) unitPrice = money(lineTotal / quantity);
    if (!Number.isFinite(quantity) && Number.isFinite(lineTotal) && unitPrice > 0) quantity = money(lineTotal / unitPrice);
    return [{ name, quantity: Number.isFinite(quantity) ? quantity : 1, unit: text(line.unit, 24) || "unit", unit_price: Number.isFinite(unitPrice) ? unitPrice : 0, line_total: Number.isFinite(lineTotal) ? lineTotal : 0 }];
  });
  const total = amount(source.total_amount);
  const creditDays = Math.round(amount(source.credit_days));
  return {
    supplier_name: text(source.supplier_name, 120),
    bill_number: text(source.bill_number, 80),
    bill_date: isoDate(source.bill_date),
    total_amount: Number.isFinite(total) ? total : money(items.reduce((sum, line) => sum + line.line_total, 0)),
    credit_days: Number.isFinite(creditDays) ? Math.min(Math.max(creditDays, 0), 365) : 0,
    items: items.length ? items : [{ name: "", quantity: 1, unit: "unit", unit_price: 0, line_total: 0 }],
  };
}

export async function POST(request: Request) {
  try {
    await requireRole("manager");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new DishaApiError("Choose a supplier invoice photo or PDF.", 400);
    if (!file.size || file.size > MAX_BYTES) throw new DishaApiError("Choose a photo or PDF smaller than 10 MB.", 413);
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = detectMime(bytes);
    if (!mime) throw new DishaApiError("Use a valid PNG, JPG, or PDF supplier invoice. HEIC photos must be saved as JPG first.", 415);
    let extracted: unknown;
    try { extracted = await extractSupplierBill({ name: file.name.slice(0, 160) || "invoice", mime, bytes }); }
    catch (cause) { console.error("Supplier invoice OCR failed", cause instanceof Error ? cause.message : "unknown"); throw new DishaApiError("Sarvam could not read this invoice. Try a clearer image or enter it from CSV.", 502); }
    const bill = { ...toDraftBill(extracted), source: "sarvam_vision" as const, source_file_name: file.name.slice(0, 180) };
    return NextResponse.json({ bill, validationErrors: validatePurchaseBill(bill), saved: false }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
