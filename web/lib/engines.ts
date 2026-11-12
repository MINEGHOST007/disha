export const AS_OF = "2026-11-14";

export type DiscrepancyKind = "DIGIT_SWAP" | "QTY_MISMATCH" | "MISSING_ITEM" | "PAYMENT_MISMATCH";
export type Reconciliation = { bill: string; item: string; expected: number; recorded: number; difference: number; kind: DiscrepancyKind; needsReview: boolean };

export function reconcileDay(): Reconciliation[] {
  const lines: Reconciliation[] = [
    { bill: "#1048", item: "Sugar 2 kg", expected: 96, recorded: 69, difference: 27, kind: "DIGIT_SWAP", needsReview: true },
    { bill: "#1017", item: "Toor dal 1 kg", expected: 140, recorded: 120, difference: 20, kind: "QTY_MISMATCH", needsReview: true },
    { bill: "#1033", item: "Sunflower oil 1 L", expected: 135, recorded: 0, difference: 135, kind: "MISSING_ITEM", needsReview: true },
    { bill: "#1009", item: "Payment total", expected: 740, recorded: 700, difference: 40, kind: "PAYMENT_MISMATCH", needsReview: true },
  ];
  return lines;
}

export function getCustomerSegments() {
  return { name: "Lakshmi", medianGap: 14, daysSince: 30, severity: 30 / 14, retentionScore: Math.round(3200 * Math.min(30 / 14, 3)), segment: "At risk" as const, balance: 340 };
}

export function predictStockout(onHand = 5, unitsSold28Days = 72, leadTime = 2) {
  const velocity = unitsSold28Days / 28;
  const daysLeft = onHand / velocity;
  const safetyBuffer = Math.ceil(2 * velocity);
  const onHandAtDelivery = Math.max(0, onHand - velocity * leadTime);
  const reorderQty = Math.max(0, Math.ceil(Math.ceil(7 * velocity) + safetyBuffer - onHandAtDelivery));
  return { velocity, daysLeft, stockoutDate: "2026-11-15", safetyBuffer, onHandAtDelivery, reorderQty, isUrgent: daysLeft <= 2 };
}

export function createReorderDraft(onHand = 5) {
  const forecast = predictStockout(onHand);
  return { sku: "Ghee 500 ml", quantity: forecast.reorderQty, supplier: "Sri Lakshmi Distributors", status: "Awaiting approval" as const };
}

export function numberIsAllowed(candidate: string, facts: Record<string, number | string>) {
  const allowed = new Set<string>();
  Object.values(facts).forEach((value) => {
    const n = String(value);
    allowed.add(n);
    const parsed = Number(n);
    if (Number.isFinite(parsed)) {
      allowed.add(parsed.toLocaleString("en-IN"));
      allowed.add(parsed.toFixed(1));
      allowed.add(String(Math.round(parsed)));
    }
  });
  const numbers = candidate.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  return numbers.every((number) => allowed.has(number) || allowed.has(number.replaceAll(",", "")));
}
