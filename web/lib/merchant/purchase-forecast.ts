export type PurchaseBillLine = {
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  sku_id?: string | null;
  pack_size?: number | null;
};

export type PurchaseBill = {
  supplier_name: string;
  bill_number: string;
  bill_date: string;
  total_amount: number;
  credit_days: number;
  items: PurchaseBillLine[];
};

export type PurchaseForecastLine = {
  supplier_name: string;
  sku_id: string | null;
  item_name: string;
  unit: string;
  bill_count: number;
  run_rate_per_day: number;
  next_interval_days: number;
  next_order_date: string;
  last_bill_quantity: number;
  predicted_quantity: number;
  pack_size: number;
  unit_price: number;
  estimated_order_value: number;
  credit_days: number;
  payment_due_date: string;
};

export type PurchaseForecastResult = {
  lines: PurchaseForecastLine[];
  needs_one_more_bill: Array<{ supplier_name: string; item_name: string; unit: string }>;
  not_reordered_last_cycle: Array<{ supplier_name: string; item_name: string; unit: string; last_purchased: string }>;
};

export type SupplierRecommendation = {
  item_name: string;
  unit: string;
  supplier_name: string;
  latest_rate: number;
  bill_date: string;
  suppliers_compared: number;
};

const DAY_MS = 86_400_000;
export const AS_OF_DATE = process.env.AS_OF_DATE ?? "2026-11-14";

export function normalizeAlias(value: string) {
  return value.trim().normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ");
}

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validIsoDate(value: string) {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS);
}

function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Arithmetic checks shown before the merchant confirms an OCR result. */
export function validatePurchaseBill(bill: PurchaseBill) {
  const errors: string[] = [];
  if (!bill.supplier_name.trim()) errors.push("Enter the supplier name.");
  if (!bill.bill_number.trim()) errors.push("Enter the supplier invoice number.");
  if (!validIsoDate(bill.bill_date)) errors.push("Use a valid invoice date in YYYY-MM-DD format.");
  if (!Number.isFinite(bill.total_amount) || bill.total_amount < 0) errors.push("Invoice total must be zero or more.");
  if (!Number.isInteger(bill.credit_days) || bill.credit_days < 0 || bill.credit_days > 365) errors.push("Credit days must be from 0 to 365.");
  if (bill.items.length === 0 || bill.items.length > 200) errors.push("Each invoice needs 1 to 200 item rows.");
  let sum = 0;
  bill.items.forEach((line, index) => {
    const label = `Line ${index + 1}`;
    if (!line.name.trim()) errors.push(`${label}: add a product name.`);
    if (!line.unit.trim()) errors.push(`${label}: add a unit.`);
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) errors.push(`${label}: quantity must be greater than zero.`);
    if (!Number.isFinite(line.unit_price) || line.unit_price < 0) errors.push(`${label}: rate must be zero or more.`);
    if (!Number.isFinite(line.line_total) || line.line_total < 0) errors.push(`${label}: amount must be zero or more.`);
    if ([line.quantity, line.unit_price, line.line_total].every(Number.isFinite) && Math.abs(line.quantity * line.unit_price - line.line_total) > 1) {
      errors.push(`${label}: quantity × rate does not match the line amount within ₹1.`);
    }
    sum += Number.isFinite(line.line_total) ? line.line_total : 0;
  });
  if (Math.abs(sum - bill.total_amount) > 1) errors.push("Invoice lines do not match the bill total within ₹1.");
  return errors;
}

/**
 * Predict purchase quantities from completed supplier-bill cycles only.
 * No on-hand inventory is estimated. Payment rupees never become SKU units.
 */
export function buildPurchaseForecast(bills: PurchaseBill[]): PurchaseForecastResult {
  const supplierBills = new Map<string, PurchaseBill[]>();
  for (const bill of bills) {
    const key = normalizeAlias(bill.supplier_name);
    const bucket = supplierBills.get(key) ?? [];
    bucket.push(bill);
    supplierBills.set(key, bucket);
  }

  const lines: PurchaseForecastLine[] = [];
  const needs_one_more_bill: PurchaseForecastResult["needs_one_more_bill"] = [];
  const not_reordered_last_cycle: PurchaseForecastResult["not_reordered_last_cycle"] = [];

  for (const group of supplierBills.values()) {
    const orderedBills = [...group].sort((a, b) => a.bill_date.localeCompare(b.bill_date) || a.bill_number.localeCompare(b.bill_number));
    const lastBill = orderedBills.at(-1)!;
    const supplierDays = [...new Set(orderedBills.map((bill) => bill.bill_date))].sort();
    const supplierGap = median(supplierDays.slice(1).map((date, index) => daysBetween(supplierDays[index], date)).filter((gap) => gap > 0));
    const latestBillItems = new Set(lastBill.items.map((line) => line.sku_id || normalizeAlias(line.name)));
    const products = new Map<string, Array<{ bill: PurchaseBill; line: PurchaseBillLine }>>();
    for (const bill of orderedBills) for (const line of bill.items) {
      const key = line.sku_id || normalizeAlias(line.name);
      const events = products.get(key) ?? [];
      events.push({ bill, line });
      products.set(key, events);
    }

    for (const [key, events] of products) {
      const first = events[0]!.line;
      if (events.length < 2) {
        needs_one_more_bill.push({ supplier_name: lastBill.supplier_name, item_name: first.name, unit: first.unit });
        continue;
      }
      if (!latestBillItems.has(key)) {
        not_reordered_last_cycle.push({ supplier_name: lastBill.supplier_name, item_name: first.name, unit: first.unit, last_purchased: events.at(-1)!.bill.bill_date });
        continue;
      }

      const completed = events.slice(0, -1).map((event, index) => {
        const days = daysBetween(event.bill.bill_date, events[index + 1]!.bill.bill_date);
        return { days, rate: days > 0 ? event.line.quantity / days : 0 };
      }).filter((event) => event.days > 0 && event.rate > 0);
      if (!completed.length) continue;
      const recentRates = completed.slice(-2).map((event) => event.rate);
      const runRate = recentRates.reduce((sum, rate) => sum + rate, 0) / recentRates.length;
      const intervalDays = Math.max(1, Math.round(supplierGap ?? median(completed.map((event) => event.days)) ?? completed.at(-1)!.days));
      const latest = events.at(-1)!;
      const pack = Number.isFinite(latest.line.pack_size) && Number(latest.line.pack_size) > 0 ? Number(latest.line.pack_size) : 1;
      const rawQuantity = runRate * intervalDays * 1.05;
      const quantity = Math.ceil(rawQuantity / pack) * pack;
      const orderDate = addDays(lastBill.bill_date, intervalDays);
      const dueDate = addDays(orderDate, lastBill.credit_days);
      lines.push({
        supplier_name: lastBill.supplier_name,
        sku_id: latest.line.sku_id ?? null,
        item_name: latest.line.name,
        unit: latest.line.unit,
        bill_count: events.length,
        run_rate_per_day: runRate,
        next_interval_days: intervalDays,
        next_order_date: orderDate,
        last_bill_quantity: latest.line.quantity,
        predicted_quantity: quantity,
        pack_size: pack,
        unit_price: latest.line.unit_price,
        estimated_order_value: roundCurrency(quantity * latest.line.unit_price),
        credit_days: lastBill.credit_days,
        payment_due_date: dueDate,
      });
    }
  }
  return { lines: lines.sort((a, b) => a.next_order_date.localeCompare(b.next_order_date) || a.supplier_name.localeCompare(b.supplier_name) || a.item_name.localeCompare(b.item_name)), needs_one_more_bill, not_reordered_last_cycle };
}

/** Suggest only suppliers that appear in uploaded merchant bills, using their latest observed rate. */
export function suggestSuppliers(bills: PurchaseBill[], forecast: PurchaseForecastResult): SupplierRecommendation[] {
  const latestByItemSupplier = new Map<string, Map<string, { supplier: string; rate: number; date: string }>>();
  for (const bill of bills) {
    for (const line of bill.items) {
      const itemKey = `${normalizeAlias(line.name)}::${normalizeAlias(line.unit)}`;
      const supplierKey = normalizeAlias(bill.supplier_name);
      const suppliers = latestByItemSupplier.get(itemKey) ?? new Map();
      const previous = suppliers.get(supplierKey);
      if (!previous || bill.bill_date > previous.date || (bill.bill_date === previous.date && line.unit_price < previous.rate)) {
        suppliers.set(supplierKey, { supplier: bill.supplier_name, rate: line.unit_price, date: bill.bill_date });
      }
      latestByItemSupplier.set(itemKey, suppliers);
    }
  }

  const seen = new Set<string>();
  return forecast.lines.flatMap((line) => {
    const itemKey = `${normalizeAlias(line.item_name)}::${normalizeAlias(line.unit)}`;
    if (seen.has(itemKey)) return [];
    seen.add(itemKey);
    const suppliers = [...(latestByItemSupplier.get(itemKey)?.values() ?? [])]
      .sort((a, b) => a.rate - b.rate || b.date.localeCompare(a.date) || a.supplier.localeCompare(b.supplier));
    const recommended = suppliers[0];
    return recommended ? [{ item_name: line.item_name, unit: line.unit, supplier_name: recommended.supplier, latest_rate: recommended.rate, bill_date: recommended.date, suppliers_compared: suppliers.length }] : [];
  }).sort((a, b) => a.item_name.localeCompare(b.item_name));
}
