import { createReorderDraft, demoGheeUnitsSold28Days, getCustomerSegments, predictStockout, projectCashFlow, reconcileDay } from "../../lib/engines";
import type { DemoBill } from "../../lib/disha/types";

export type DemoSignal = "daily_run" | "new_bill" | "stock_change" | "voice_command";
export type Intent = "STOCK_QUERY" | "CUSTOMER_STATUS" | "TODAY_PRIORITIES" | "APPROVE" | "REJECT" | "STOCK_UPDATE" | "UNKNOWN";

export function routeSignal(signal: DemoSignal) {
  const routes: Record<DemoSignal, string[]> = {
    daily_run: ["reconcile_day", "get_customer_segments", "predict_stockout"],
    new_bill: ["reconcile_day"],
    stock_change: ["predict_stockout"],
    voice_command: ["get_customer_segments", "predict_stockout"],
  };
  return [...routes[signal]];
}

const defaultTeluguDigits = "౦౧౨౩౪౫౬౭౮౯";
const teluguDigits = process.env.TE_DIGITS?.length === 10 ? process.env.TE_DIGITS : defaultTeluguDigits;

export function normalizeVoiceDigits(input: string) {
  return input.replace(/[౦-౯]/g, (digit) => String(teluguDigits.indexOf(digit)));
}

export function parseStockChange(input: string, currentOnHand: number) {
  const text = normalizeVoiceDigits(input).toLocaleLowerCase();
  const amount = Number(text.match(/\d+/)?.[0]);
  if (!Number.isInteger(amount) || amount < 0) return null;
  const delta = /\b(add|increase|reduce|decrease|remove|subtract)\b|జోడించ|తగ్గించ/.test(text);
  if (delta) {
    const negative = /\b(reduce|decrease|remove|subtract)\b|తగ్గించ/.test(text);
    return negative ? -amount : amount;
  }
  const absolute = /\b(set|change|update)\b|మార్చ|సెట్/.test(text);
  return absolute ? amount - currentOnHand : null;
}

export function classifyIntent(input: string): Intent {
  const text = normalizeVoiceDigits(input).toLocaleLowerCase();
  if (/\b(add|increase|reduce|decrease|remove|subtract|set|change|update)\b.*\b(stock|ghee|rice|sugar)\b|(?:స్టాక్|నెయ్యి).*\d|\d.*(?:స్టాక్|నెయ్యి)/.test(text)) return "STOCK_UPDATE";
  if (/\b(approve|yes,? do it|confirm)\b|ఆమోదించు/.test(text)) return "APPROVE";
  if (/\b(reject|no,? thanks|cancel)\b|వద్దు/.test(text)) return "REJECT";
  if (/\b(stock|inventory|ghee|rice|sugar)\b|స్టాక్|నెయ్యి/.test(text)) return "STOCK_QUERY";
  if (/\b(customers?|lakshmi|visit|balance)\b|కస్టమర్|లక్ష్మి/.test(text)) return "CUSTOMER_STATUS";
  if (/\b(today|priorities|briefing|sales)\b|ఈ రోజు|అమ్మకాలు/.test(text)) return "TODAY_PRIORITIES";
  return "UNKNOWN";
}

export function runDemoTool(name: string, input: { onHand?: number; billRecorded?: number; festivalMultiplier?: number; extraBills?: DemoBill[] } = {}) {
  switch (name) {
    case "reconcile_day": return reconcileDay(input.billRecorded ?? 69);
    case "get_customer_segments": return getCustomerSegments();
    case "predict_stockout": return predictStockout(input.onHand ?? 5, demoGheeUnitsSold28Days(input.extraBills), 2, input.festivalMultiplier ?? 1);
    case "project_cash_flow": return projectCashFlow(30, input.extraBills);
    case "draft_whatsapp_message": return { status: "PROPOSED", simulated: true };
    case "create_reorder_draft": return { status: "PROPOSED", quantity: createReorderDraft(input.onHand ?? 5, input.festivalMultiplier ?? 1, demoGheeUnitsSold28Days(input.extraBills)).quantity };
    case "update_stock_from_voice": return { status: "PROPOSED", onHand: input.onHand ?? 5, requiresApproval: true };
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
