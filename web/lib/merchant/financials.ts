import { normalizeAlias, roundCurrency } from "./purchase-forecast";

export type MerchantTransaction = {
  id: string;
  ts: string;
  customer_name: string;
  amount: number;
  mode: string;
  status: "success" | "failed" | "pending";
};

export type CustomerAlias = { customer_name: string; alias: string };

const DAY_MS = 86_400_000;
export const DIGITAL_MODE = /(?:paytm|upi|digital|card|qr|wallet|net\s?bank)/i;

function dateOf(value: string) { return value.slice(0, 10); }
function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end.slice(0, 10)}T00:00:00Z`) - Date.parse(`${start.slice(0, 10)}T00:00:00Z`)) / DAY_MS);
}
function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function projectCashFlow(orderTotal: number, creditDays: number, transactions: MerchantTransaction[], asOfDate: string) {
  const start = new Date(Date.parse(`${asOfDate}T00:00:00Z`) - 28 * DAY_MS).toISOString().slice(0, 10);
  const end = new Date(Date.parse(`${asOfDate}T00:00:00Z`) - 1 * DAY_MS).toISOString().slice(0, 10);
  const eligible = transactions.filter((tx) => tx.status === "success" && DIGITAL_MODE.test(tx.mode) && dateOf(tx.ts) >= start && dateOf(tx.ts) <= end);
  const collected = roundCurrency(eligible.reduce((sum, tx) => sum + Number(tx.amount), 0));
  const averageRaw = eligible.reduce((sum, tx) => sum + Number(tx.amount), 0) / 28;
  const avgDaily = roundCurrency(averageRaw);
  const expected = roundCurrency(averageRaw * Math.max(0, creditDays));
  return {
    available: eligible.length > 0,
    transaction_count: eligible.length,
    window_start: start,
    window_end: end,
    digital_collections_28d: collected,
    average_daily_digital_collections: avgDaily,
    credit_days: creditDays,
    expected_digital_collections: expected,
    order_total: roundCurrency(orderTotal),
    possible_gap: eligible.length ? roundCurrency(Math.max(0, orderTotal - expected)) : null,
    caveat: "Digital collections only; cash sales are not visible. Other expenses are not included.",
  };
}

export type CustomerFrequency = {
  customer_name: string;
  payment_days: number;
  median_gap_days: number;
  days_since_last_payment: number;
  ratio_to_typical_gap: number;
  potentially_at_risk: boolean;
  last_payment_date: string;
};

export function customerFrequency(transactions: MerchantTransaction[], aliases: CustomerAlias[], asOfDate: string): CustomerFrequency[] {
  const aliasToName = new Map<string, string>();
  for (const item of aliases) {
    aliasToName.set(normalizeAlias(item.alias), item.customer_name);
    aliasToName.set(normalizeAlias(item.customer_name), item.customer_name);
  }
  const datesByCustomer = new Map<string, Set<string>>();
  const labelByCustomer = new Map<string, string>();
  for (const tx of transactions) {
    if (tx.status !== "success" || !tx.customer_name.trim()) continue;
    const label = aliasToName.get(normalizeAlias(tx.customer_name)) ?? tx.customer_name.trim();
    const key = normalizeAlias(label);
    const dates = datesByCustomer.get(key) ?? new Set<string>();
    dates.add(dateOf(tx.ts));
    datesByCustomer.set(key, dates);
    labelByCustomer.set(key, label);
  }
  const result: CustomerFrequency[] = [];
  for (const [key, datesSet] of datesByCustomer) {
    const dates = [...datesSet].sort();
    if (dates.length < 3) continue;
    const gaps = dates.slice(1).map((date, index) => daysBetween(dates[index]!, date)).filter((days) => days > 0);
    const typicalGap = median(gaps);
    if (!typicalGap) continue;
    const elapsed = Math.max(0, daysBetween(dates.at(-1)!, asOfDate));
    const ratio = elapsed / typicalGap;
    result.push({ customer_name: labelByCustomer.get(key)!, payment_days: dates.length, median_gap_days: typicalGap, days_since_last_payment: elapsed, ratio_to_typical_gap: ratio, potentially_at_risk: ratio >= 1.5, last_payment_date: dates.at(-1)! });
  }
  return result.sort((a, b) => b.ratio_to_typical_gap - a.ratio_to_typical_gap || a.customer_name.localeCompare(b.customer_name));
}

export function findPaymentsFrom(name: string, transactions: MerchantTransaction[], aliases: CustomerAlias[], fromDate?: string, toDate?: string) {
  const query = normalizeAlias(name);
  const canonical = aliases.find((item) => normalizeAlias(item.alias) === query || normalizeAlias(item.customer_name) === query)?.customer_name;
  const target = normalizeAlias(canonical ?? name);
  return transactions.filter((tx) => {
    if (tx.status !== "success" || normalizeAlias(tx.customer_name) !== target) return false;
    const date = dateOf(tx.ts);
    return (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
  }).sort((a, b) => b.ts.localeCompare(a.ts));
}

export type KhataEntry = {
  id: string;
  customer_name: string;
  amount: number;
  paid_amount: number;
  created_at: string;
  due_date?: string | null;
  contact_phone?: string | null;
  note?: string | null;
  closed_at?: string | null;
  auto_match: boolean;
  status: "open" | "partially_paid" | "closed";
};

export type KhataAllocation = { entry_id: string; transaction_id: string; amount: number; transaction_ts: string };

/** Allocate a newly imported successful payment to the oldest matching enabled Khata entries. */
export function matchTransactionToKhata(entries: KhataEntry[], transaction: MerchantTransaction, aliases: CustomerAlias[]) {
  if (transaction.status !== "success") return { entries, allocations: [] as KhataAllocation[] };
  const aliasNames = new Map<string, string>();
  for (const alias of aliases) {
    aliasNames.set(normalizeAlias(alias.alias), normalizeAlias(alias.customer_name));
    aliasNames.set(normalizeAlias(alias.customer_name), normalizeAlias(alias.customer_name));
  }
  const txName = aliasNames.get(normalizeAlias(transaction.customer_name)) ?? normalizeAlias(transaction.customer_name);
  let remaining = Number(transaction.amount);
  const allocations: KhataAllocation[] = [];
  const sorted = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const updated = new Map(entries.map((entry) => [entry.id, { ...entry }]));
  for (const entry of sorted) {
    if (!entry.auto_match || entry.status === "closed" || remaining <= 0) continue;
    if (Date.parse(transaction.ts) < Date.parse(entry.created_at)) continue;
    const entryName = aliasNames.get(normalizeAlias(entry.customer_name)) ?? normalizeAlias(entry.customer_name);
    if (entryName !== txName) continue;
    const due = Math.max(0, Number(entry.amount) - Number(entry.paid_amount));
    if (!due) continue;
    const amount = Math.min(due, remaining);
    if (amount <= 0) continue;
    allocations.push({ entry_id: entry.id, transaction_id: transaction.id, amount, transaction_ts: transaction.ts });
    remaining = roundCurrency(remaining - amount);
    const nextPaid = roundCurrency(entry.paid_amount + amount);
    updated.set(entry.id, { ...entry, paid_amount: nextPaid, status: nextPaid >= entry.amount ? "closed" : "partially_paid" });
  }
  return { entries: entries.map((entry) => updated.get(entry.id)!), allocations };
}
