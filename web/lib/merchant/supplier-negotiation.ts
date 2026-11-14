import { z } from "zod";
import { normalizeAlias } from "./purchase-forecast";

export type ApprovedLine = { item_name: string; quantity: number; unit: string; unit_price: number };
export type ObservedRate = { item_name: string; unit: string; supplier_name: string; rate: number; bill_date: string };
export type NegotiationTarget = ApprovedLine & { ceiling: number; target: number; leverage: ObservedRate | null };

export const supplierPersonas = {
  cooperative: { label: "Cooperative regular", brief: "Friendly long-time supplier. Quotes the merchant's approved rates and will give a small discount if asked politely." },
  hard_bargainer: { label: "Hard bargainer", brief: "Claims input costs went up and opens above the approved rates. Concedes slowly, only when pushed with a reason." },
  short_stock: { label: "Short on stock", brief: "Agreeable on price but cannot supply the full quantity of the largest line this week." },
  upseller: { label: "Upseller", brief: "Pushes bigger quantities and a costlier substitute brand in exchange for a better rate." },
} as const;
export type SupplierPersona = keyof typeof supplierPersonas;

export const transcriptTurnSchema = z.object({ speaker: z.enum(["agent", "supplier"]), text: z.string().trim().min(1).max(600) }).strict();
export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;

export const dealLineSchema = z.object({ item_name: z.string().trim().min(1).max(120), quantity: z.number().nonnegative(), unit_price: z.number().nonnegative() });
export type DealLine = z.infer<typeof dealLineSchema>;

const round2 = (value: number) => Math.round(value * 100) / 100;
const itemKey = (name: string, unit: string) => `${normalizeAlias(name)}::${normalizeAlias(unit)}`;

/**
 * Ceiling is the merchant-approved rate; Disha may never agree above it.
 * Target is the lowest rate the merchant actually paid another supplier, or a
 * 3% ask when no cheaper evidence exists.
 */
export function negotiationTargets(lines: ApprovedLine[], observed: ObservedRate[], supplierName: string): NegotiationTarget[] {
  const self = normalizeAlias(supplierName);
  return lines.map((line) => {
    const key = itemKey(line.item_name, line.unit);
    const cheaper = observed
      .filter((rate) => itemKey(rate.item_name, rate.unit) === key && normalizeAlias(rate.supplier_name) !== self && rate.rate < line.unit_price)
      .sort((a, b) => a.rate - b.rate || b.bill_date.localeCompare(a.bill_date))[0] ?? null;
    return { ...line, ceiling: line.unit_price, target: cheaper ? cheaper.rate : round2(line.unit_price * 0.97), leverage: cheaper };
  });
}

export type DealEvaluation = {
  outcome: "confirmed" | "improved" | "needs_review";
  approvedTotal: number;
  dealTotal: number;
  /** Price savings on the units actually agreed; quantity shortfalls are issues, not savings. */
  savings: number;
  issues: string[];
};

/** Deterministic check of a negotiated deal against the approved order. */
export function evaluateDeal(approved: ApprovedLine[], deal: DealLine[]): DealEvaluation {
  const issues: string[] = [];
  const byName = new Map(deal.map((line) => [normalizeAlias(line.item_name), line]));
  let dealTotal = 0;
  let improved = false;
  let savings = 0;
  for (const line of approved) {
    const agreed = byName.get(normalizeAlias(line.item_name));
    byName.delete(normalizeAlias(line.item_name));
    if (!agreed) { issues.push(`${line.item_name} is missing from the agreed order.`); continue; }
    if (agreed.quantity !== line.quantity) issues.push(`${line.item_name}: quantity ${agreed.quantity} instead of approved ${line.quantity} ${line.unit}.`);
    if (agreed.unit_price > line.unit_price) issues.push(`${line.item_name}: ₹${agreed.unit_price} is above the approved ₹${line.unit_price}.`);
    if (agreed.unit_price < line.unit_price) improved = true;
    savings += (line.unit_price - agreed.unit_price) * agreed.quantity;
    dealTotal += agreed.quantity * agreed.unit_price;
  }
  for (const extra of byName.values()) { issues.push(`${extra.item_name} was not in the approved order.`); dealTotal += extra.quantity * extra.unit_price; }
  const approvedTotal = round2(approved.reduce((sum, line) => sum + line.quantity * line.unit_price, 0));
  dealTotal = round2(dealTotal);
  return { outcome: issues.length ? "needs_review" : improved ? "improved" : "confirmed", approvedTotal, dealTotal, savings: round2(savings), issues };
}

/**
 * Hidden supplier-side limits so the simulated seller behaves consistently.
 * `walkaway` is today's lowest price: it starts at the opening quote and moves a
 * third of the way to the floor each time the caller pushes back.
 */
export function supplierPrivateTerms(persona: SupplierPersona, lines: ApprovedLine[], pushbacks = 0) {
  const step = Math.min(1, Math.max(0, pushbacks) / 3);
  const largest = lines.reduce((best, line, index) => line.quantity * line.unit_price > lines[best]!.quantity * lines[best]!.unit_price ? index : best, 0);
  return lines.map((line, index) => {
    const opening = persona === "hard_bargainer" ? round2(line.unit_price * 1.08) : line.unit_price;
    const floor = round2(line.unit_price * (persona === "cooperative" ? 0.97 : persona === "hard_bargainer" ? 0.99 : persona === "upseller" ? 0.95 : 0.98));
    const available = persona === "short_stock" && index === largest ? Math.floor(line.quantity * 0.6) : line.quantity;
    return { item_name: line.item_name, unit: line.unit, opening, floor, walkaway: round2(opening - (opening - floor) * step), available };
  });
}
