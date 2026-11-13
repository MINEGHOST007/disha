import { AS_OF, DEMO_SEED, seededGheeUnitsSold28Days } from "./seed";
import { isDigitSwap, predictStockout as predictStockoutCore, VELOCITY_WINDOW_DAYS } from "./engine-core";

export { AS_OF, DEMO_SEED, generateSeedData, seededGheeUnitsSold28Days } from "./seed";
export { allowedNumbers, isDigitSwap, numberIsAllowed, validateNarration, VELOCITY_WINDOW_DAYS } from "./engine-core";

export type DiscrepancyKind = "DIGIT_SWAP" | "QTY_MISMATCH" | "MISSING_ITEM" | "PAYMENT_MISMATCH";
export type Reconciliation = {
  bill: string;
  item: string;
  expected: number;
  recorded: number;
  difference: number;
  kind: DiscrepancyKind;
  needsReview: boolean;
};

type BillLine = {
  skuId: string;
  item: string;
  qty: number;
  unitPriceRecorded: number;
  lineTotalRecorded: number;
};

type Bill = {
  id: string;
  number: number;
  date: string;
  total: number;
  customerId?: string | null;
  lines: BillLine[];
  payments?: { amount: number }[];
};

type Discount = { skuId: string; date: string; amount: number; approved: boolean };
type StockMovement = { id: string; billId: string; skuId: string; date: string; qty: number };
type Customer = {
  id: string;
  name: string;
  monthlySpend: number;
  balanceDue?: number;
  visits: string[];
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function reconcileDay(billRecorded = 69): Reconciliation[] {
  const discrepancies = reconcileSeededWindow(7);
  const firstDifference = round2(96 - billRecorded);
  const digitSwap = discrepancies.find((row) => row.bill === "#1048");
  if (!digitSwap) return discrepancies;
  return [
    {
      ...digitSwap,
      recorded: billRecorded,
      difference: firstDifference,
      kind: isDigitSwap(96, billRecorded) ? "DIGIT_SWAP" : "QTY_MISMATCH",
      needsReview: firstDifference !== 0,
    },
    ...discrepancies.filter((row) => row.bill !== "#1048"),
  ];
}

export function reconcileBills(
  bills: Bill[],
  priceList: Record<string, number>,
  discounts: Discount[] = [],
  movements: StockMovement[] = [],
): Reconciliation[] {
  const results: Reconciliation[] = [];
  for (const bill of bills) {
    for (const line of bill.lines) {
      const expected = round2(line.qty * (priceList[line.skuId] ?? line.unitPriceRecorded));
      const recorded = round2(line.lineTotalRecorded);
      if (expected === recorded) continue;
      const approvedDiscount = discounts.some((discount) =>
        discount.approved && discount.skuId === line.skuId && discount.date === bill.date &&
        round2(discount.amount) === round2(expected - recorded));
      if (approvedDiscount) continue;
      const kind: DiscrepancyKind = isDigitSwap(expected, recorded)
        ? "DIGIT_SWAP"
        : round2(line.qty * line.unitPriceRecorded) !== recorded
          ? "QTY_MISMATCH"
          : "QTY_MISMATCH";
      results.push({
        bill: `#${bill.number}`,
        item: line.item,
        expected,
        recorded,
        difference: round2(expected - recorded),
        kind,
        needsReview: true,
      });
    }

    const billSkus = new Set(bill.lines.map((line) => line.skuId));
    for (const movement of movements) {
      if (movement.billId === bill.id && !billSkus.has(movement.skuId)) {
        const expected = round2(movement.qty * (priceList[movement.skuId] ?? 0));
        results.push({
          bill: `#${bill.number}`,
          item: movement.skuId,
          expected,
          recorded: 0,
          difference: expected,
          kind: "MISSING_ITEM",
          needsReview: true,
        });
      }
    }

    const paymentTotal = round2((bill.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0));
    if (bill.payments && paymentTotal !== round2(bill.total)) {
      results.push({
        bill: `#${bill.number}`,
        item: "Payment total",
        expected: round2(bill.total),
        recorded: paymentTotal,
        difference: round2(bill.total - paymentTotal),
        kind: "PAYMENT_MISMATCH",
        needsReview: true,
      });
    }
  }
  return results;
}

export function reconcileSeededWindow(days = 7) {
  const priceList = Object.fromEntries(DEMO_SEED.skus.map((sku) => [sku.id, sku.price]));
  const bills = DEMO_SEED.bills.filter((bill) => {
    const age = daysBetween(bill.date, AS_OF);
    return age > 0 && age <= days;
  });
  return reconcileBills(bills, priceList, DEMO_SEED.discounts, DEMO_SEED.stockMovements);
}

function daysBetween(earlier: string, later: string) {
  return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000);
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function segmentCustomers(customers: Customer[], bills: Pick<Bill, "date" | "id" | "customerId">[] = [], asOf = AS_OF) {
  return customers.map((customer) => {
    const billVisits = bills
      .filter((bill) => bill.customerId === customer.id)
      .map((bill) => bill.date);
    const visits = Array.from(new Set(customer.visits.length ? customer.visits : billVisits)).sort();
    const gaps = visits.slice(1).map((visit, index) => daysBetween(visits[index], visit));
    const medianGap = median(gaps);
    const daysSince = visits.length ? Math.max(0, daysBetween(visits[visits.length - 1], asOf)) : 0;
    const severity = medianGap > 0 ? daysSince / medianGap : 0;
    const segment: "At risk" | "Active" | "New" = visits.length < 4 ? "New" : daysSince > 2 * medianGap ? "At risk" : "Active";
    return {
      id: customer.id,
      name: customer.name,
      medianGap,
      daysSince,
      severity,
      retentionScore: Math.round(customer.monthlySpend * Math.min(severity, 3)),
      segment,
      monthlySpend: customer.monthlySpend,
      balance: customer.balanceDue ?? 0,
    };
  });
}

export function getCustomerSegments() {
  return segmentCustomers([DEMO_SEED.customers[0]])[0];
}

export function getAllCustomerSegments() {
  return segmentCustomers(DEMO_SEED.customers);
}

export function predictStockout(onHand = 5, unitsSold28Days = 72, leadTime = 2, festivalMultiplier = 1) {
  return predictStockoutCore(onHand, unitsSold28Days, leadTime, festivalMultiplier, AS_OF);
}

export function forecastSku(
  sku: { id: string; onHand: number; leadTimeDays?: number },
  bills: { date: string; lines: { skuId: string; qty: number }[] }[],
  asOf = AS_OF,
) {
  const unitsSold28Days = bills.reduce((total, bill) => {
    const age = daysBetween(bill.date, asOf);
    if (age <= 0 || age > VELOCITY_WINDOW_DAYS) return total;
    return total + bill.lines.reduce((lineTotal, line) => lineTotal + (line.skuId === sku.id ? line.qty : 0), 0);
  }, 0);
  return { unitsSold28Days, ...predictStockout(sku.onHand, unitsSold28Days, sku.leadTimeDays ?? 2) };
}

export function forecastAllSkus(asOf = AS_OF) {
  return DEMO_SEED.skus.map((sku) => ({
    ...sku,
    ...forecastSku(sku, DEMO_SEED.bills, asOf),
  }));
}

export function demoGheeUnitsSold28Days(extraBills: import("./disha/types").DemoBill[] = []) {
  const addedUnits = extraBills.reduce((total, bill) => {
    const age = daysBetween(bill.date, AS_OF);
    return total + (age >= 0 && age <= VELOCITY_WINDOW_DAYS ? bill.gheeQty : 0);
  }, 0);
  return seededGheeUnitsSold28Days() + addedUnits;
}

export function createReorderDraft(onHand = 5, festivalMultiplier = 1, unitsSold28Days = seededGheeUnitsSold28Days()) {
  const forecast = predictStockout(onHand, unitsSold28Days, 2, festivalMultiplier);
  return { sku: "Ghee 500 ml", quantity: forecast.reorderQty, supplier: "Sri Lakshmi Distributors", status: "Awaiting approval" as const };
}

export function topCandidates<T extends { id: string; category: "billing" | "retention" | "inventory"; score: number; daysLeft?: number }>(candidates: T[]) {
  const order = ["billing", "retention", "inventory"] as const;
  return order.flatMap((category) => {
    const matching = candidates.filter((candidate) => candidate.category === category);
    matching.sort((a, b) => category === "inventory" && a.daysLeft !== undefined && b.daysLeft !== undefined
      ? a.daysLeft - b.daysLeft || a.id.localeCompare(b.id)
      : b.score - a.score || a.id.localeCompare(b.id));
    return matching.slice(0, 1);
  });
}

export function projectCashFlow(days = 30, extraBills: import("./disha/types").DemoBill[] = []) {
  const horizon = Math.min(90, Math.max(1, Math.floor(days)));
  const costs = Object.fromEntries(DEMO_SEED.skus.map((sku) => [sku.id, sku.cost]));
  const dailyNet = new Map<string, number>();

  for (const bill of DEMO_SEED.bills) {
    const cost = bill.lines.reduce((total, line) => total + line.qty * (costs[line.skuId] ?? 0), 0);
    dailyNet.set(bill.date, (dailyNet.get(bill.date) ?? 0) + bill.total - cost);
  }
  for (const bill of extraBills) {
    dailyNet.set(bill.date, (dailyNet.get(bill.date) ?? 0) + bill.total - bill.inventoryCost);
  }

  const shiftDate = (date: string, offset: number) => {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  const forecastFor = (date: string, trainingThrough = shiftDate(date, -1)) => {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const samples = Array.from({ length: 56 }, (_, index) => {
      const sampleDate = shiftDate(trainingThrough, -index);
      return { sampleDate, value: dailyNet.get(sampleDate) };
    })
      .filter((sample): sample is { sampleDate: string; value: number } => sample.value !== undefined && new Date(`${sample.sampleDate}T00:00:00Z`).getUTCDay() === weekday)
      .map((sample) => sample.value);
    const mean = samples.length ? samples.reduce((sum, value) => sum + value, 0) / samples.length : 0;
    const variance = samples.length > 1 ? samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (samples.length - 1) : 0;
    const margin = 1.28 * Math.sqrt(variance);
    return { forecast: mean, low: mean - margin, high: mean + margin, bandWidth: margin * 2 };
  };

  const series = Array.from({ length: horizon }, (_, index) => {
    const date = shiftDate(AS_OF, index + 1);
    return { date, ...forecastFor(date) };
  });
  const holdoutDates = Array.from({ length: 7 }, (_, index) => shiftDate(AS_OF, index - 7));
  const actual = holdoutDates.reduce((sum, date) => sum + (dailyNet.get(date) ?? 0), 0);
  const holdoutTrainingThrough = shiftDate(holdoutDates[0], -1);
  const forecast = holdoutDates.reduce((sum, date) => sum + forecastFor(date, holdoutTrainingThrough).forecast, 0);

  return {
    status: "ready" as const,
    days: horizon,
    series,
    holdout: {
      days: holdoutDates.length,
      actual,
      forecast,
      errorPercent: Math.abs(forecast - actual) / Math.max(Math.abs(actual), 1) * 100,
    },
  };
}
