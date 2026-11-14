import { describe, expect, it } from "vitest";
import { evaluateDeal, negotiationTargets, supplierPrivateTerms, type ApprovedLine } from "./supplier-negotiation";

const approved: ApprovedLine[] = [
  { item_name: "Sugar 1 kg", quantity: 110, unit: "pc", unit_price: 45 },
  { item_name: "Ghee 500 ml", quantity: 72, unit: "pc", unit_price: 300 },
];

describe("supplier negotiation", () => {
  it("targets the cheapest rate another supplier actually billed", () => {
    const targets = negotiationTargets(approved, [
      { item_name: "sugar 1 KG", unit: "pc", supplier_name: "Balaji Wholesale", rate: 43, bill_date: "2026-10-01" },
      { item_name: "Sugar 1 kg", unit: "pc", supplier_name: "Sri Lakshmi Traders", rate: 40, bill_date: "2026-10-02" },
    ], "Sri Lakshmi Traders");
    expect(targets[0]).toMatchObject({ ceiling: 45, target: 43, leverage: { supplier_name: "Balaji Wholesale" } });
    expect(targets[1]).toMatchObject({ ceiling: 300, target: 291, leverage: null });
  });

  it("confirms the exact approved order and credits lower prices as savings", () => {
    expect(evaluateDeal(approved, approved).outcome).toBe("confirmed");
    const better = evaluateDeal(approved, [{ ...approved[0]!, unit_price: 44 }, approved[1]!]);
    expect(better).toMatchObject({ outcome: "improved", savings: 110, issues: [] });
  });

  it("sends price rises, quantity changes, missing and extra items to merchant review", () => {
    const result = evaluateDeal(approved, [
      { item_name: "Sugar 1 kg", quantity: 66, unit_price: 45 },
      { item_name: "Premium ghee", quantity: 72, unit_price: 320 },
    ]);
    expect(result.outcome).toBe("needs_review");
    expect(result.issues).toHaveLength(3);
    expect(evaluateDeal(approved, [{ ...approved[0]!, quantity: 66 }, approved[1]!]).savings).toBe(0);
    expect(evaluateDeal(approved, [{ ...approved[0]!, unit_price: 46 }, approved[1]!]).outcome).toBe("needs_review");
  });

  it("gives each persona consistent private limits", () => {
    expect(supplierPrivateTerms("hard_bargainer", approved)[0]).toMatchObject({ opening: 48.6, floor: 44.55, walkaway: 48.6 });
    expect(supplierPrivateTerms("hard_bargainer", approved, 3)[0]!.walkaway).toBe(44.55);
    expect(supplierPrivateTerms("short_stock", approved).map((line) => line.available)).toEqual([110, 43]);
  });
});
