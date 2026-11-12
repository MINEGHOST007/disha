import { getCustomerSegments, predictStockout, reconcileDay } from "./engines";

export type DemoSignal = "daily_run" | "new_bill" | "stock_change" | "voice_command";
export type Intent = "STOCK_QUERY" | "CUSTOMER_STATUS" | "TODAY_PRIORITIES" | "APPROVE" | "REJECT" | "STOCK_UPDATE" | "UNKNOWN";

export const TOOL_REGISTRY = [
  { name: "reconcile_day", mode: "read" },
  { name: "get_customer_segments", mode: "read" },
  { name: "predict_stockout", mode: "read" },
  { name: "project_cash_flow", mode: "read" },
  { name: "draft_whatsapp_message", mode: "consequential" },
  { name: "create_reorder_draft", mode: "consequential" },
  { name: "update_stock_from_voice", mode: "consequential" },
] as const;

export function routeSignal(signal: DemoSignal) {
  const routes: Record<DemoSignal, string[]> = {
    daily_run: ["reconcile_day", "get_customer_segments", "predict_stockout"],
    new_bill: ["reconcile_day"],
    stock_change: ["predict_stockout"],
    voice_command: ["get_customer_segments", "predict_stockout"],
  };
  return [...routes[signal]];
}

export function classifyIntent(input: string): Intent {
  const text = input.toLocaleLowerCase();
  if (/\b(add|set|change|update)\b.*\b(stock|ghee|rice|sugar)\b|స్టాక్.*\d/.test(text)) return "STOCK_UPDATE";
  if (/\b(approve|yes,? do it|confirm)\b|ఆమోదించు/.test(text)) return "APPROVE";
  if (/\b(reject|no,? thanks|cancel)\b|వద్దు/.test(text)) return "REJECT";
  if (/\b(stock|inventory|ghee|rice|sugar)\b|స్టాక్|నెయ్యి/.test(text)) return "STOCK_QUERY";
  if (/\b(customer|lakshmi|visit|balance)\b|కస్టమర్|లక్ష్మి/.test(text)) return "CUSTOMER_STATUS";
  if (/\b(today|priorities|briefing|sales)\b|ఈ రోజు|అమ్మకాలు/.test(text)) return "TODAY_PRIORITIES";
  return "UNKNOWN";
}

export function runDemoTool(name: string, input: { onHand?: number } = {}) {
  switch (name) {
    case "reconcile_day": return reconcileDay();
    case "get_customer_segments": return getCustomerSegments();
    case "predict_stockout": return predictStockout(input.onHand ?? 5);
    case "project_cash_flow": return { status: "Phase 2", message: "Cash-flow projection is not part of this demo." };
    case "draft_whatsapp_message": return { status: "PROPOSED", simulated: true };
    case "create_reorder_draft": return { status: "PROPOSED", quantity: predictStockout(input.onHand ?? 5).reorderQty };
    case "update_stock_from_voice": return { status: "PROPOSED", onHand: input.onHand ?? 5, requiresApproval: true };
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
