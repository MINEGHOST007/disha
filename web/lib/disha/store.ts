import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database";
import { createReorderDraft, demoGheeUnitsSold28Days, DEMO_SEED, forecastAllSkus, getAllCustomerSegments, getCustomerSegments, predictStockout, reconcileDay, reconcileSeededWindow } from "@/lib/engines";
import { AS_OF, LEDGER_END, LEDGER_START } from "@/lib/seed";
import type { ActivityLog, DashboardSnapshot, DemoBill, DemoState, ProposalRecord, ProposalType } from "./types";
import { DishaApiError } from "./http";

export const DEFAULT_DEMO_STATE: DemoState = {
  onHand: 5,
  billRecorded: 69,
  billExpected: 96,
  billNumber: 1048,
  salesTotal: 14296,
  billCount: 62,
  festivalMultiplier: 1,
  extraBills: [],
};

function demoAnalytics(onHand: number, festivalMultiplier: number, extraBills: DemoBill[]) {
  const extraGheeUnits = demoGheeUnitsSold28Days(extraBills) - demoGheeUnitsSold28Days();
  const stock = forecastAllSkus().map((sku) => sku.id === "sku_ghee"
    ? { ...sku, unitsSold28Days: sku.unitsSold28Days + extraGheeUnits, onHand, ...predictStockout(onHand, sku.unitsSold28Days + extraGheeUnits, sku.leadTimeDays, festivalMultiplier) }
    : sku);
  return {
    customers: getAllCustomerSegments(),
    stock,
    discrepancies: reconcileSeededWindow(),
    dataset: {
      asOf: AS_OF,
      start: LEDGER_START,
      end: LEDGER_END,
      billCount: DEMO_SEED.bills.length + extraBills.length,
      customerCount: DEMO_SEED.customers.length,
      skuCount: DEMO_SEED.skus.length,
      checksum: DEMO_SEED.checksum,
    },
  };
}

const auditColumns = "id,created_at,actor,tool,facts,narration,decision,outcome,fallback_used";

function normalizeState(value: unknown): DemoState {
  if (!value || typeof value !== "object") return DEFAULT_DEMO_STATE;
  const state = value as Partial<DemoState>;
  return {
    onHand: finiteNumber(state.onHand, DEFAULT_DEMO_STATE.onHand),
    billRecorded: finiteNumber(state.billRecorded, DEFAULT_DEMO_STATE.billRecorded),
    billExpected: finiteNumber(state.billExpected, DEFAULT_DEMO_STATE.billExpected),
    billNumber: finiteNumber(state.billNumber, DEFAULT_DEMO_STATE.billNumber),
    salesTotal: finiteNumber(state.salesTotal, DEFAULT_DEMO_STATE.salesTotal),
    billCount: finiteNumber(state.billCount, DEFAULT_DEMO_STATE.billCount),
    festivalMultiplier: Math.min(3, Math.max(1, finiteNumber(state.festivalMultiplier, 1))),
    extraBills: Array.isArray(state.extraBills) ? state.extraBills.filter(isDemoBill).slice(-100) : [],
  };
}

function isDemoBill(value: unknown): value is DemoBill {
  if (!value || typeof value !== "object") return false;
  const bill = value as Partial<DemoBill>;
  return typeof bill.id === "string" && typeof bill.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(bill.date)
    && Number.isFinite(bill.total) && Number.isFinite(bill.inventoryCost) && Number.isInteger(bill.gheeQty);
}

function finiteNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function logLabel(row: Record<string, unknown>): ActivityLog {
  const facts = (row.facts && typeof row.facts === "object" ? row.facts : {}) as Record<string, unknown>;
  const tool = String(row.tool ?? "activity");
  const decision = String(row.decision ?? "recorded");
  const outcome = String(row.outcome ?? "");
  const actionLabels: Record<string, string> = {
    billing_correction: "Bill #1048 correction",
    message: "Customer message",
    reorder: "Purchase draft",
    stock_update: "Stock update",
    demo_stock_editor: "Stock count changed",
    demo_bill_editor: "Synthetic demo bill",
    festival_multiplier: "Festival forecast setting",
    voice_intent: "Voice request",
    reconcile_day: "Bill review",
    reset_demo: "Demo reset",
  };
  const decisionLabels: Record<string, string> = {
    proposed: "Prepared for approval",
    approved: "Approved by merchant",
    rejected: "Declined by merchant",
    executed: "Completed in sandbox",
    edited: "Saved in sandbox",
    dismissed: "Marked legitimate",
    classified: "Request understood",
    refused: "Blocked by approval gate",
    reset: "Seed state restored",
  };
  const detail = detailFor(tool, facts, outcome);
  const time = new Date(String(row.created_at ?? Date.now())).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    id: String(row.id ?? `${row.created_at}-${tool}`),
    time,
    action: actionLabels[tool] ?? tool.replaceAll("_", " "),
    detail,
    result: decisionLabels[decision] ?? (outcome.replaceAll("_", " ") || "Recorded"),
  };
}

function detailFor(tool: string, facts: Record<string, unknown>, outcome: string) {
  if (tool === "billing_correction") {
    return `Bill #${facts.bill_number ?? 1048} · ₹${facts.recorded ?? 69} to ₹${facts.expected ?? 96}`;
  }
  if (tool === "message") return `${facts.name ?? "Lakshmi"} · simulated message`;
  if (tool === "reorder") return `${facts.sku_name ?? "Ghee 500 ml"} · ${facts.qty ?? 0} units`;
  if (tool === "stock_update" || tool === "demo_stock_editor") {
    return `Ghee 500 ml · ${facts.old_on_hand ?? facts.current_on_hand ?? "—"} to ${facts.new_on_hand ?? facts.onHand ?? "—"} units`;
  }
  if (tool === "demo_bill_editor") return `Bill ₹${facts.total ?? 0} · ${facts.ghee_qty ?? 0} ghee jars · ${facts.date ?? ""}`;
  if (tool === "festival_multiplier") return `Festival demand multiplier · ${facts.festivalMultiplier ?? 1}×`;
  if (tool === "reconcile_day") return "Bill #1048 marked as legitimate · ledger unchanged";
  if (tool === "voice_intent") return `Intent: ${facts.intent ?? outcome}`;
  if (tool === "reset_demo") return "Synthetic demo data restored";
  return outcome.replaceAll("_", " ") || "Sandbox event";
}

async function readStateRow() {
  const { data, error } = await getSupabaseAdmin()
    .from("disha_demo_state")
    .select("payload,audit_cursor")
    .eq("id", "demo")
    .maybeSingle();
  if (error) throw new DishaApiError("Supabase could not load the demo state.", 503);
  return data;
}

export async function getCurrentDemoState() {
  const row = await readStateRow();
  if (!row) throw new DishaApiError("The Disha demo state has not been initialized.", 503);
  return normalizeState(row.payload);
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  try {
    const row = await readStateRow();
    if (!row) throw new Error("Disha demo state is missing");
    const cursor = Number(row.audit_cursor ?? 0);
    const { data, error } = await getSupabaseAdmin()
      .from("disha_audit_log")
      .select(auditColumns)
      .gt("id", cursor)
      .order("id", { ascending: false })
      .limit(100);
    if (error) throw error;
    const state = normalizeState(row.payload);
    return {
      state,
      logs: (data ?? []).map((entry) => logLabel(entry as Record<string, unknown>)),
      storageAvailable: true,
      analytics: demoAnalytics(state.onHand, state.festivalMultiplier, state.extraBills),
    };
  } catch {
    return {
      state: DEFAULT_DEMO_STATE,
      logs: [],
      storageAvailable: false,
      analytics: demoAnalytics(DEFAULT_DEMO_STATE.onHand, DEFAULT_DEMO_STATE.festivalMultiplier, DEFAULT_DEMO_STATE.extraBills),
    };
  }
}

export async function listAuditLogs() {
  const row = await readStateRow();
  if (!row) throw new DishaApiError("The Disha demo state has not been initialized.", 503);
  const { data, error } = await getSupabaseAdmin()
    .from("disha_audit_log")
    .select(auditColumns)
    .gt("id", Number(row.audit_cursor ?? 0))
    .order("id", { ascending: false })
    .limit(100);
  if (error) throw new DishaApiError("The audit log could not be loaded.", 503);
  return (data ?? []).map((entry) => logLabel(entry as Record<string, unknown>));
}

export async function listProposals() {
  const { data, error } = await getSupabaseAdmin()
    .from("disha_proposals")
    .select("id,type,status,facts,reason,narration,fallback_used,created_at,resolved_at,outcome,result")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new DishaApiError("Proposals could not be loaded.", 503);
  return (data ?? []) as ProposalRecord[];
}

export async function createProposal(type: ProposalType, language: "te" | "en" = "en", qtyChange?: number) {
  const state = await getCurrentDemoState();
  const reconciliation = reconcileDay(state.billRecorded)[0];
  let facts: Record<string, unknown>;
  let reason: string;

  if (type === "billing_correction") {
    if (!reconciliation?.needsReview) {
      throw new DishaApiError("Bill #1048 has already been corrected in this sandbox.", 409);
    }
    facts = {
      bill_id: "2026-11-13-1048",
      bill_number: 1048,
      line_index: 0,
      sku_id: "sku_sugar",
      sku_name: "Sugar 2 kg",
      qty: 1,
      expected: reconciliation.expected,
      recorded: reconciliation.recorded,
      difference: reconciliation.difference,
      kind: reconciliation.kind,
    };
    reason = `Bill #1048 has a ₹${reconciliation.difference} difference to review.`;
  } else if (type === "message") {
    const customer = getCustomerSegments();
    facts = {
      customer_id: customer.id,
      name: customer.name,
      median_gap: customer.medianGap,
      days_since: customer.daysSince,
      balance_due: customer.balance,
      label: "At risk",
      message_text_te: "నమస్కారం లక్ష్మి గారు! మీకు ఇష్టమైన వస్తువులు అందుబాటులో ఉన్నాయి. మీకు వీలైనప్పుడు దుకాణానికి రండి.",
      message_text_en: "Namaste Lakshmi garu! Your favourite items are available. Please visit the shop whenever convenient.",
    };
    reason = `Lakshmi may appreciate a check-in after ${customer.daysSince} days away; her usual visit gap is ${customer.medianGap} days.`;
  } else if (type === "reorder") {
    const unitsSold28Days = demoGheeUnitsSold28Days(state.extraBills);
    const forecast = predictStockout(state.onHand, unitsSold28Days, 2, state.festivalMultiplier);
    if (forecast.reorderQty <= 0) throw new DishaApiError("Current stock does not need a reorder draft.", 409);
    const draft = createReorderDraft(state.onHand, state.festivalMultiplier, unitsSold28Days);
    facts = {
      sku_id: "sku_ghee",
      sku_name: "Ghee 500 ml",
      qty: draft.quantity,
      supplier_name: draft.supplier,
      on_hand: state.onHand,
      daily_velocity: forecast.velocity,
      days_left: forecast.daysLeft,
      stockout_date: forecast.stockoutDate,
    };
    reason = `Ghee 500 ml has ${forecast.daysLeft.toFixed(1)} days of stock left; prepare a ${draft.quantity}-unit purchase draft.`;
  } else {
    if (!Number.isInteger(qtyChange) || qtyChange === 0) {
      throw new DishaApiError("Enter a whole-number stock change.", 400);
    }
    const next = state.onHand + Number(qtyChange);
    if (next < 0 || next > 10000) throw new DishaApiError("Stock must remain between 0 and 10,000 units.", 400);
    facts = {
      sku_id: "sku_ghee",
      sku_name: "Ghee 500 ml",
      current_on_hand: state.onHand,
      qty_change: qtyChange,
      new_on_hand: next,
      unit: "jars",
    };
    reason = `Confirm the Ghee 500 ml stock change from ${state.onHand} to ${next} jars.`;
  }

  const { data, error } = await getSupabaseAdmin().rpc("disha_create_proposal", {
    p_type: type,
    p_facts: { ...facts, requested_language: language } as Json,
    p_reason: reason,
    p_narration: null,
    p_fallback_used: true,
  });
  if (error) throw new DishaApiError("The proposal could not be saved.", 503);
  return data as ProposalRecord;
}

export async function approveProposal(id: string, language: "te" | "en", messageText?: string) {
  const { data, error } = await getSupabaseAdmin().rpc("disha_approve_proposal", {
    p_proposal_id: id,
    p_language: language,
    p_message_text: messageText ?? null,
  });
  if (error) throw rpcError(error.code);
  const proposal = data as ProposalRecord;
  if (proposal.status === "FAILED") throw new DishaApiError("The action failed. No external system was contacted.", 500);
  return proposal;
}

export async function rejectProposal(id: string, reason = "Dismissed by merchant") {
  const { data, error } = await getSupabaseAdmin().rpc("disha_reject_proposal", {
    p_proposal_id: id,
    p_reason: reason.slice(0, 300),
  });
  if (error) throw rpcError(error.code);
  return data as ProposalRecord;
}

function rpcError(code?: string) {
  if (code === "P0002") return new DishaApiError("That proposal could not be found.", 404);
  if (code === "P0001") return new DishaApiError("This proposal has already been resolved.", 409);
  return new DishaApiError("The sandbox could not resolve this proposal.", 503);
}

export async function updateDemoState(patch: { onHand?: number; festivalMultiplier?: number }, tool: "demo_stock_editor" | "festival_multiplier") {
  if (patch.onHand !== undefined && (!Number.isInteger(patch.onHand) || patch.onHand < 0 || patch.onHand > 10000)) {
    throw new DishaApiError("Stock must be a whole number from 0 to 10,000.", 400);
  }
  if (patch.festivalMultiplier !== undefined && (!Number.isFinite(patch.festivalMultiplier) || patch.festivalMultiplier < 1 || patch.festivalMultiplier > 3)) {
    throw new DishaApiError("Festival multiplier must be between 1.0 and 3.0.", 400);
  }
  if (!Object.keys(patch).length) throw new DishaApiError("There is no demo change to save.", 400);
  const { data, error } = await getSupabaseAdmin().rpc("disha_update_demo_state", {
    p_patch: patch,
    p_tool: tool,
    p_facts: patch as Json,
  });
  if (error) throw new DishaApiError("The demo settings could not be saved.", 503);
  return normalizeState(data);
}

export async function addDemoBill(total: number, inventoryCost: number, gheeQty: number) {
  const state = await getCurrentDemoState();
  if (!Number.isInteger(total) || total < 1 || total > 1_000_000) throw new DishaApiError("Bill total must be a whole number from 1 to 1,000,000.", 400);
  if (!Number.isInteger(inventoryCost) || inventoryCost < 0 || inventoryCost > 1_000_000) throw new DishaApiError("Inventory cost must be a whole number from 0 to 1,000,000.", 400);
  if (!Number.isInteger(gheeQty) || gheeQty < 0 || gheeQty > 100) throw new DishaApiError("Ghee quantity must be a whole number from 0 to 100.", 400);
  if (gheeQty > state.onHand) throw new DishaApiError("The bill cannot sell more ghee than is in stock.", 409);

  const bill: DemoBill = { id: randomUUID(), date: LEDGER_END, total, inventoryCost, gheeQty };
  const patch = {
    extraBills: [...state.extraBills, bill].slice(-100),
    onHand: state.onHand - gheeQty,
    salesTotal: state.salesTotal + total,
    billCount: state.billCount + 1,
  };
  const { data, error } = await getSupabaseAdmin().rpc("disha_update_demo_state", {
    p_patch: patch,
    p_tool: "demo_bill_editor",
    p_facts: { date: bill.date, total, inventory_cost: inventoryCost, ghee_qty: gheeQty },
  });
  if (error) throw new DishaApiError("The demo bill could not be saved.", 503);
  return normalizeState(data);
}

export async function resetDemo() {
  const { data, error } = await getSupabaseAdmin().rpc("disha_reset_demo");
  if (error) throw new DishaApiError("The demo could not be reset.", 503);
  return normalizeState(data);
}

export async function recordAuditEvent(event: "dismiss_reconciliation" | "tool_refused" | "tool_ran" | "voice_intent", details: Record<string, unknown> = {}) {
  const base = event === "dismiss_reconciliation"
    ? { actor: "merchant", tool: "reconcile_day", facts: { bill_number: 1048 }, decision: "dismissed", outcome: "ledger_unchanged" }
    : event === "tool_refused"
      ? { actor: "agent", tool: String(details.tool ?? "unknown"), facts: { reason: "direct execution without merchant approval" }, decision: "refused", outcome: "blocked" }
      : event === "voice_intent"
        ? { actor: "merchant", tool: "voice_intent", facts: { intent: String(details.intent ?? "UNKNOWN") }, decision: "classified", outcome: String(details.intent ?? "UNKNOWN") }
        : { actor: "agent", tool: String(details.tool ?? "unknown"), facts: {}, decision: "ran", outcome: "ok" };
  const { error } = await getSupabaseAdmin().from("disha_audit_log").insert(base as Database["public"]["Tables"]["disha_audit_log"]["Insert"]);
  if (error) throw new DishaApiError("The audit event could not be saved.", 503);
}
