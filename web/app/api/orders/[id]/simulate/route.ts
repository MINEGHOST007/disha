import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, DishaApiError, readJson } from "@/lib/disha/http";
import { negotiationTargets, supplierPersonas, transcriptTurnSchema, type ObservedRate, type SupplierPersona } from "@/lib/merchant/supplier-negotiation";
import { MAX_SIMULATED_TURNS, nextAgentTurn, nextSupplierTurn } from "@/lib/merchant/supplier-simulation";
import { requireRole } from "@/lib/supabase/authz";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  turn: z.enum(["agent", "supplier"]),
  persona: z.enum(Object.keys(supplierPersonas) as [SupplierPersona, ...SupplierPersona[]]).default("cooperative"),
  transcript: z.array(transcriptTurnSchema).max(MAX_SIMULATED_TURNS + 4),
}).strict();

/** Rehearsal only: reads the order and bill history, never dials or changes the order. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await requireRole("manager");
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) throw new DishaApiError("Order draft not found.", 404);
    const input = schema.safeParse(await readJson(request));
    if (!input.success) throw new DishaApiError("Send the call transcript and whose turn it is.", 400);

    const supabase = await createClient();
    const [orderResult, linesResult, merchantResult, suppliersResult, billsResult, billLinesResult] = await Promise.all([
      supabase.from("disha_order_drafts").select("id,supplier_name").eq("merchant_id", workspace.merchantId).eq("id", id).maybeSingle(),
      supabase.from("disha_order_draft_lines").select("item_name,quantity,unit,unit_price").eq("merchant_id", workspace.merchantId).eq("order_id", id).limit(200),
      supabase.from("disha_merchants").select("name").eq("id", workspace.merchantId).maybeSingle(),
      supabase.from("disha_suppliers").select("id,name").eq("merchant_id", workspace.merchantId).limit(1000),
      supabase.from("disha_purchase_bills").select("id,supplier_id,bill_date").eq("merchant_id", workspace.merchantId).limit(5000),
      supabase.from("disha_purchase_bill_lines").select("purchase_bill_id,item_name,unit,unit_price").eq("merchant_id", workspace.merchantId).limit(10000),
    ]);
    if (orderResult.error || linesResult.error) throw new DishaApiError("The order could not be loaded.", 503);
    if (!orderResult.data) throw new DishaApiError("Order draft not found.", 404);
    const approved = (linesResult.data ?? []).map((line) => ({ item_name: line.item_name, quantity: Number(line.quantity), unit: line.unit, unit_price: Number(line.unit_price) }));
    if (!approved.length) throw new DishaApiError("This order has no items to discuss.", 400);

    const suppliers = new Map((suppliersResult.data ?? []).map((supplier) => [supplier.id, supplier.name]));
    const bills = new Map((billsResult.data ?? []).map((bill) => [bill.id, bill]));
    const observed: ObservedRate[] = (billLinesResult.data ?? []).flatMap((line) => {
      const bill = bills.get(line.purchase_bill_id);
      const supplierName = bill && suppliers.get(bill.supplier_id);
      return bill && supplierName ? [{ item_name: line.item_name, unit: line.unit, supplier_name: supplierName, rate: Number(line.unit_price), bill_date: bill.bill_date }] : [];
    });

    const supplierName = orderResult.data.supplier_name;
    const targets = negotiationTargets(approved, observed, supplierName);
    const turn = input.data.turn === "agent"
      ? await nextAgentTurn({ supplierName, merchantName: merchantResult.data?.name ?? "the merchant", targets, transcript: input.data.transcript })
      : await nextSupplierTurn({ supplierName, persona: input.data.persona, approved, transcript: input.data.transcript });
    return NextResponse.json({ turn, targets }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
