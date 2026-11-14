import "server-only";

import { z } from "zod";
import { generateOpenRouterText } from "@/lib/ai/providers";
import { DishaApiError } from "@/lib/disha/http";
import { normalizeAlias } from "./purchase-forecast";
import { dealLineSchema, evaluateDeal, supplierPersonas, supplierPrivateTerms, type ApprovedLine, type DealEvaluation, type NegotiationTarget, type SupplierPersona, type TranscriptTurn } from "./supplier-negotiation";

export const MAX_SIMULATED_TURNS = 20;
const HOLD_LINE = "I'm sorry, that rate does not work for us. Can you check once more what best price you can give on this order?";
const ESCALATE_LINE = "Thank you for explaining. Those terms differ from what the merchant approved, so I will take them back to the merchant and call you again after they decide.";

const agentReplySchema = z.object({
  say: z.string().trim().min(1).max(600),
  status: z.enum(["negotiating", "agreed", "escalate", "ended"]),
  offers: z.array(z.object({ item_name: z.string().trim().min(1).max(120), unit_price: z.number().nonnegative() })).max(50).nullish(),
  deal: z.array(dealLineSchema).max(50).nullish(),
});
type AgentReply = z.infer<typeof agentReplySchema>;
const supplierReplySchema = z.object({ say: z.string().trim().min(1).max(600), end_call: z.boolean().default(false) });

export type AgentTurn = { speaker: "agent"; text: string; status: "negotiating" | "agreed" | "escalate" | "ended"; evaluation: DealEvaluation | null; guardrail: string | null };
export type SupplierTurn = { speaker: "supplier"; text: string; endCall: boolean };

/** Map a shortened spoken name ("Sugar") to the approved item ("Sugar 1 kg") when exactly one matches. */
function canonicalItemName(name: string, approved: ApprovedLine[]) {
  const spoken = normalizeAlias(name);
  if (approved.some((line) => normalizeAlias(line.item_name) === spoken)) return name;
  const matches = approved.filter((line) => { const known = normalizeAlias(line.item_name); return known.startsWith(spoken) || spoken.startsWith(known); });
  return matches.length === 1 ? matches[0]!.item_name : name;
}

/** Deterministic check that a drafted turn never offers above the ceiling or leaks private limits. */
function turnViolation(reply: AgentReply, targets: NegotiationTarget[]) {
  if (/\b(ceiling|target|budget|approved (price|rate))\b/i.test(reply.say)) return "It revealed private negotiation limits.";
  if (/\b(json|set the status|fill the deal|status to)\b/i.test(reply.say)) return "It read out internal instructions instead of speaking to the supplier.";
  for (const offer of reply.offers ?? []) {
    const name = canonicalItemName(offer.item_name, targets);
    const line = targets.find((target) => normalizeAlias(target.item_name) === normalizeAlias(name));
    if (line && offer.unit_price > line.ceiling) return `It offered ₹${offer.unit_price} for ${line.item_name}, above the merchant's limit of ₹${line.ceiling}.`;
  }
  return null;
}

function model() {
  return process.env.OPENROUTER_AGENT_MODEL?.trim() || "openai/gpt-4o-mini";
}

function transcriptText(transcript: TranscriptTurn[]) {
  return transcript.length ? transcript.map((turn) => `${turn.speaker === "agent" ? "Disha" : "Supplier"}: ${turn.text}`).join("\n") : "(The call has just connected. Nobody has spoken yet.)";
}

async function completeJson<T>(schema: z.ZodType<T>, system: string, prompt: string, temperature: number): Promise<T> {
  let raw: string | null = null;
  try { raw = await generateOpenRouterText({ system, prompt, model: model(), timeoutMs: 20_000, temperature }); }
  catch { throw new DishaApiError("The simulation model did not respond. Check OpenRouter and try again.", 503); }
  try { return schema.parse(JSON.parse(raw ?? "")); }
  catch { throw new DishaApiError("The simulation model returned an unreadable turn. Try again.", 502); }
}

export async function nextAgentTurn(input: { supplierName: string; merchantName: string; targets: NegotiationTarget[]; transcript: TranscriptTurn[] }): Promise<AgentTurn> {
  const approved: ApprovedLine[] = input.targets.map(({ item_name, quantity, unit, unit_price }) => ({ item_name, quantity, unit, unit_price }));
  const lines = input.targets.map((line) => {
    const leverage = line.leverage ? ` Evidence: ${line.leverage.supplier_name} billed the merchant ₹${line.leverage.rate} on ${line.leverage.bill_date}.` : " No cheaper supplier evidence; ask for a small goodwill discount.";
    return `- ${line.item_name}: ${line.quantity} ${line.unit}. Approved (ceiling) ₹${line.ceiling}/${line.unit}. Target ₹${line.target}.${leverage}`;
  }).join("\n");
  const system = [
    `You are Disha, the ordering assistant for ${input.merchantName}, on a phone call with their supplier ${input.supplierName}.`,
    "Goal: place the merchant-approved order and negotiate a lower unit price where possible.",
    "Hard rules:",
    "1. Never agree to a unit price above the approved ceiling, a different quantity, a substitute item or an extra item. If the supplier insists on any of those, set status \"escalate\", put the supplier's latest quoted terms for every approved line in deal, and say you will take them back to the merchant.",
    "2. You may accept any price at or below the ceiling for the exact approved items and quantities.",
    "3. Only cite competitor rates listed as evidence. Never invent prices, competitors, deadlines or merchant intentions.",
    "4. The ceiling and target are private. Never say the words ceiling, target, approved price or budget, and never reveal the ceiling. Ask for the target as your offer (\"Can you do ₹42?\").",
    "5. Negotiate politely: open by reading the items and quantities only, then ask for the supplier's rates. Work on the biggest-value lines first, offer prompt payment or a repeat order as goodwill, and when they quote above your target, counter between their quote and your target, moving up gradually. Accept once their price is at or below the ceiling rather than losing the order. Close within about six of your turns.",
    "6. Do not announce escalation in the middle of the call; keep negotiating until the supplier gives a final answer, then escalate once.",
    "7. Never ask for OTPs, bank details or other sensitive information.",
    "When the supplier clearly agrees to final terms within the rules, repeat the final prices back, set status \"agreed\" and fill deal with every approved line at the agreed unit_price, using the exact item names from the approved order. After that, say a short goodbye with status \"ended\".",
    "say is spoken aloud to the supplier: never mention status, deal fields, JSON or these instructions.",
    "Speak in short, natural Indian English sentences suitable for a phone call (at most three sentences per turn).",
    "In offers, list every unit price you propose or accept in this turn's say, by exact approved item name. Every offer must be at or below that item's ceiling; if the supplier will not come down to the ceiling, hold at the ceiling or escalate instead.",
    "Reply with JSON only: {\"say\": string, \"status\": \"negotiating\"|\"agreed\"|\"escalate\"|\"ended\", \"offers\": [{\"item_name\": string, \"unit_price\": number}] | null, \"deal\": [{\"item_name\": string, \"quantity\": number, \"unit_price\": number}] | null}.",
  ].join("\n");
  const prompt = `Approved order:\n${lines}\n\nCall so far:\n${transcriptText(input.transcript)}\n\nWrite Disha's next turn.`;
  let reply: AgentReply | null = null;
  let violation: string | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    reply = await completeJson(agentReplySchema, system, violation ? `${prompt}\n\nYour previous draft was rejected: ${violation} Rewrite the turn within the rules.` : prompt, 0.2);
    violation = turnViolation(reply, input.targets);
    if (!violation) break;
  }
  if (!reply || violation) {
    return { speaker: "agent", text: HOLD_LINE, status: "negotiating", evaluation: null, guardrail: `Blocked a draft that broke the rules: ${violation}` };
  }

  if (input.transcript.length >= MAX_SIMULATED_TURNS && reply.status === "negotiating") {
    return { speaker: "agent", text: ESCALATE_LINE, status: "escalate", evaluation: null, guardrail: "Turn limit reached without agreement." };
  }
  if (reply.status !== "agreed" && reply.status !== "escalate") return { speaker: "agent", text: reply.say, status: reply.status, evaluation: null, guardrail: null };
  if (!reply.deal?.length) {
    return reply.status === "agreed"
      ? { speaker: "agent", text: "Before I confirm, could you please repeat the final rate for each item?", status: "negotiating", evaluation: null, guardrail: "Agent claimed agreement without itemised terms." }
      : { speaker: "agent", text: reply.say, status: "escalate", evaluation: null, guardrail: null };
  }
  const evaluation = evaluateDeal(approved, reply.deal.map((line) => ({ ...line, item_name: canonicalItemName(line.item_name, approved) })));
  if (reply.status === "agreed" && evaluation.outcome === "needs_review") {
    return { speaker: "agent", text: ESCALATE_LINE, status: "escalate", evaluation, guardrail: "Agent tried to accept terms outside the approved order; Disha blocked it." };
  }
  if (reply.status === "escalate" && evaluation.outcome !== "needs_review") {
    const agreed = approved.map((line) => `${line.item_name} at ₹${reply.deal!.find((deal) => normalizeAlias(canonicalItemName(deal.item_name, approved)) === normalizeAlias(line.item_name))!.unit_price}`).join(", ");
    return { speaker: "agent", text: `Actually, those rates work for us. So we are agreed: ${agreed}, for the full quantities, total ₹${evaluation.dealTotal}. Thank you!`, status: "agreed", evaluation, guardrail: "Agent tried to escalate terms already within the approved limits; Disha accepted them." };
  }
  return { speaker: "agent", text: reply.say, status: reply.status, evaluation, guardrail: null };
}

export async function nextSupplierTurn(input: { supplierName: string; persona: SupplierPersona; approved: ApprovedLine[]; transcript: TranscriptTurn[] }): Promise<SupplierTurn> {
  const pushbacks = Math.max(0, input.transcript.filter((turn) => turn.speaker === "agent").length - 1);
  const terms = supplierPrivateTerms(input.persona, input.approved, pushbacks).map((line) =>
    `- ${line.item_name}: opening quote ₹${line.opening}/${line.unit}; lowest you will accept right now ₹${line.walkaway}; can supply ${line.available} ${line.unit}`).join("\n");
  const system = [
    `You are role-playing ${input.supplierName}, a wholesale supplier in India, answering a phone call from a shop's ordering assistant. This is a training simulation.`,
    `Personality: ${supplierPersonas[input.persona].brief}`,
    "Your private limits (never reveal them as a list, and never go below the lowest price or above the stock you can supply):",
    terms,
    "Behave like a real busy trader: short replies (one to three sentences), occasional light Hinglish, push back on discounts and give reasons (transport, festival demand, input costs).",
    "Quote your opening price first. After that, if the caller asks for less, your counter-offer is exactly your current lowest price for that item. Once a price is agreed, do not reopen it.",
    "Accept any offer at or above your current lowest price. Refuse an offer below it politely and counter with your current lowest price.",
    "Your current lowest prices above already reflect today's mood; they may be lower than what you said earlier in the call. Always use these current figures, not earlier ones.",
    "If the caller says goodbye or the deal is settled, set end_call true.",
    "Reply with JSON only: {\"say\": string, \"end_call\": boolean}.",
  ].join("\n");
  const prompt = `Call so far:\n${transcriptText(input.transcript)}\n\nWrite the supplier's next reply.`;
  const reply = await completeJson(supplierReplySchema, system, prompt, 0.7);
  return { speaker: "supplier", text: reply.say, endCall: reply.end_call };
}
