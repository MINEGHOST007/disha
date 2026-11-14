import { describe, expect, it } from "vitest";
import { buildPurchaseForecast, isFestivalScenarioActive, seasonalOrderQuantity, suggestSuppliers, validatePurchaseBill, type PurchaseBill } from "./purchase-forecast";
import { customerFrequency, matchTransactionToKhata, projectCashFlow, type KhataEntry, type MerchantTransaction } from "./financials";

const rows = [
  ["Ghee 500 ml", 72, 300, 6], ["Sugar 1 kg", 112, 45, 10], ["Sunflower oil 1 L", 84, 140, 12],
  ["Toor dal 1 kg", 56, 160, 10], ["Rice 25 kg bag", 34, 944, 5], ["Atta 10 kg", 56, 380, 10],
] as const;
const item = (name: string, qty: number, price: number, pack: number) => ({ name, quantity: qty, unit: "pc", unit_price: price, line_total: qty * price, pack_size: pack });
const makeBill = (bill_date: string, bill_number: string, withDetergent = true): PurchaseBill => ({
  supplier_name: "Sri Lakshmi Traders", bill_number, bill_date, credit_days: 7,
  items: [
    ...rows.map(([name, qty, price, pack]) => item(name, qty, price, pack)),
    ...(withDetergent ? [item("Detergent powder 1 kg", 24, 180, 1)] : []),
  ],
  total_amount: rows.reduce((sum, [, qty, price]) => sum + qty * price, 0) + (withDetergent ? 24 * 180 : 0),
});

describe("supplier bill and forecast engines", () => {
  it("validates invoice arithmetic with a ₹1 tolerance", () => {
    const bill = makeBill("2026-10-18", "SLT-0418", false);
    expect(validatePurchaseBill(bill)).toEqual([]);
    bill.items[0]!.line_total -= 2;
    expect(validatePurchaseBill(bill).some((error) => error.includes("Line 1"))).toBe(true);
  });

  it("reproduces the SRS order quantities, date and total", () => {
    const result = buildPurchaseForecast([
      makeBill("2026-08-23", "SLT-0416"),
      makeBill("2026-09-20", "SLT-0417"),
      makeBill("2026-10-18", "SLT-0418", false),
    ]);
    expect(Object.fromEntries(result.lines.map((line) => [line.item_name, line.predicted_quantity]))).toEqual({
      "Ghee 500 ml": 78, "Sugar 1 kg": 120, "Sunflower oil 1 L": 96,
      "Toor dal 1 kg": 60, "Rice 25 kg bag": 40, "Atta 10 kg": 60,
    });
    expect(result.lines.map((line) => line.estimated_order_value).reduce((sum, value) => sum + value, 0)).toBe(112_400);
    expect(result.lines[0]?.next_order_date).toBe("2026-11-15");
    expect(result.not_reordered_last_cycle).toContainEqual(expect.objectContaining({ item_name: "Detergent powder 1 kg" }));
  });

  it("does not invent a quantity from one invoice", () => {
    const result = buildPurchaseForecast([makeBill("2026-10-18", "SLT-0418", false)]);
    expect(result.lines).toHaveLength(0);
    expect(result.needs_one_more_bill).toHaveLength(6);
  });

  it("suggests the lowest latest observed rate among suppliers already in the merchant's bills", () => {
    const lakshmi = makeBill("2026-10-18", "SLT-0418", false);
    const other = { ...makeBill("2026-10-19", "MK-9", false), supplier_name: "Market King", items: makeBill("2026-10-19", "MK-9", false).items.map((line) => line.name === "Ghee 500 ml" ? { ...line, unit_price: 280, line_total: 72 * 280 } : line) };
    const bills = [makeBill("2026-09-20", "SLT-0417", false), lakshmi, other];
    const suggestions = suggestSuppliers(bills, buildPurchaseForecast(bills));
    expect(suggestions.find((item) => item.item_name === "Ghee 500 ml")).toMatchObject({ supplier_name: "Market King", latest_rate: 280, suppliers_compared: 2 });
  });

  it("applies a saved festival estimate only before the next order and rounds to packs", () => {
    expect(isFestivalScenarioActive("2026-11-28", "2026-11-14", "2026-12-12")).toBe(true);
    expect(isFestivalScenarioActive("2026-12-20", "2026-11-14", "2026-12-12")).toBe(false);
    expect(seasonalOrderQuantity(41, 12, 20, true)).toBe(60);
    expect(seasonalOrderQuantity(41, 12, 20, false)).toBe(41);
    expect(() => seasonalOrderQuantity(41, 12, 201, true)).toThrow(RangeError);
  });
});

const transaction = (id: string, ts: string, customer_name: string, amount: number, status: MerchantTransaction["status"] = "success"): MerchantTransaction => ({ id, ts, customer_name, amount, mode: "UPI", status });

describe("cash-flow and customer engines", () => {
  it("uses successful transactions only over the prior 28 days", () => {
    const transactions = [
      transaction("1", "2026-10-20T10:00:00+05:30", "A", 376_000),
      transaction("2", "2026-10-22T10:00:00+05:30", "B", 999_999, "failed"),
      transaction("3", "2026-11-14T10:00:00+05:30", "C", 999_999),
    ];
    const result = projectCashFlow(112_400, 7, transactions, "2026-11-14");
    expect(result.average_daily_digital_collections).toBe(13_428.57);
    expect(result.expected_digital_collections).toBe(94_000);
    expect(result.possible_gap).toBe(18_400);
    expect(result.caveat).toMatch(/cash sales are not visible/i);
  });

  it("flags customers whose payment gap reached 1.5 times their usual gap", () => {
    const lakshmi = ["2026-08-20", "2026-09-03", "2026-09-17", "2026-10-01", "2026-10-15"].map((date, index) => transaction(String(index), `${date}T10:00:00Z`, "Lakshmi", 100));
    const venkat = ["2026-10-21", "2026-10-28", "2026-11-04", "2026-11-11"].map((date, index) => transaction(`v${index}`, `${date}T10:00:00Z`, "Venkat", 100));
    const result = customerFrequency([...lakshmi, ...venkat], [{ customer_name: "Lakshmi", alias: "లక్ష్మి" }], "2026-11-14");
    expect(result.find((item) => item.customer_name === "Lakshmi")).toMatchObject({ median_gap_days: 14, days_since_last_payment: 30, potentially_at_risk: true });
    expect(result.find((item) => item.customer_name === "Venkat")).toMatchObject({ median_gap_days: 7, days_since_last_payment: 3, potentially_at_risk: false });
  });
});

describe("Khata payment allocation", () => {
  it("uses only post-entry matching payments and closes only when the balance is covered", () => {
    const entries: KhataEntry[] = [
      { id: "older", customer_name: "Ramesh", amount: 600, paid_amount: 0, created_at: "2026-11-01T00:00:00Z", auto_match: true, status: "open" },
      { id: "newer", customer_name: "Ramesh", amount: 500, paid_amount: 0, created_at: "2026-11-10T00:00:00Z", auto_match: true, status: "open" },
    ];
    const old = transaction("old", "2026-10-31T20:00:00Z", "రమేష్", 500);
    const ignored = matchTransactionToKhata(entries, old, [{ customer_name: "Ramesh", alias: "రమేష్" }]);
    expect(ignored.allocations).toEqual([]);
    const recent = transaction("recent", "2026-11-14T11:42:00Z", "రమేష్", 850);
    const matched = matchTransactionToKhata(entries, recent, [{ customer_name: "Ramesh", alias: "రమేష్" }]);
    expect(matched.allocations.map((allocation) => allocation.amount)).toEqual([600, 250]);
    expect(matched.entries.map((entry) => entry.status)).toEqual(["closed", "partially_paid"]);
  });

  it("matches any successfully recorded payment mode to Khata", () => {
    const entry: KhataEntry = { id:"cash-entry",customer_name:"Ramesh",amount:300,paid_amount:0,created_at:"2026-11-01T00:00:00Z",auto_match:true,status:"open" };
    const cash = { ...transaction("cash", "2026-11-02T10:00:00Z", "Ramesh", 300), mode:"cash" };
    expect(matchTransactionToKhata([entry],cash,[]).entries[0]?.status).toBe("closed");
  });
});
