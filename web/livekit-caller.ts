import { fileURLToPath } from "node:url";
import { cli, defineAgent, ServerOptions, voice } from "@livekit/agents";
import { LLM } from "@livekit/agents-plugin-openai";
import { STT } from "@livekit/agents-plugin-sarvam";
import { TTS } from "@livekit/agents-plugin-sarvam";

type ApprovedOrder = {
  orderId: string;
  supplierName: string;
  lines: Array<{ item_name: string; quantity: number; unit: string; unit_price: number; line_total: number }>;
  orderTotal: number;
};

function key(name: string, alias?: string) {
  return process.env[name]?.trim() || (alias ? process.env[alias]?.trim() : undefined);
}

export default defineAgent({
  entry: async (ctx) => {
    const order = JSON.parse(ctx.job.metadata || "{}") as ApprovedOrder;
    if (!order.orderId || !order.supplierName || !Array.isArray(order.lines) || !order.lines.length) {
      console.error("Supplier call dispatch is missing approved order facts");
      ctx.shutdown();
      return;
    }
    const openRouterKey = key("OPENROUTER_API_KEY", "OPENROUTER");
    const sarvamKey = key("SARVAM_API_KEY", "SARVAM");
    if (!openRouterKey || !sarvamKey) {
      console.error("Supplier call agent needs OpenRouter and Sarvam credentials");
      ctx.shutdown();
      return;
    }
    await ctx.connect();
    await ctx.waitForParticipant(`supplier-${order.orderId}`);
    const lines = order.lines.map((line) => `${line.item_name}: ${line.quantity} ${line.unit} at INR ${line.unit_price} per unit (line total INR ${line.line_total})`).join("; ");
    const instructions = [
      "You are Disha, speaking as a merchant's ordering assistant on a live phone call to their supplier.",
      `Supplier: ${order.supplierName}. Merchant-approved exact order: ${lines}. Total estimate INR ${order.orderTotal}.`,
      "Read this approved order clearly and ask whether the supplier can fulfill it. Speak in concise natural Indian English; follow the seller's language when possible.",
      "Treat the approved item names, quantities, units, prices, and totals as immutable. Do not add, remove, substitute, or change any item, quantity, unit, price, credit term, or delivery date.",
      "If the seller proposes any changed quantity, price, item, or term, say you will take it back to the merchant for approval. Do not agree to the change or say the modified order is placed.",
      "If the seller explicitly confirms the exact approved list, repeat that confirmation and end politely. Never claim a change was approved by the merchant.",
      "Do not request OTPs, bank credentials, or unrelated sensitive information. Ask for clarification when a product or quantity is not understood.",
    ].join(" ");
    const language = process.env.SARVAM_CALL_LANGUAGE?.trim() || "en-IN";
    const session = new voice.AgentSession({
      stt: new STT({ model: "saaras:v3", apiKey: sarvamKey, languageCode: "unknown" }),
      llm: new LLM({ model: process.env.OPENROUTER_AGENT_MODEL || "openai/gpt-4o-mini", baseURL: "https://openrouter.ai/api/v1", apiKey: openRouterKey, temperature: 0.1, maxCompletionTokens: 240 }),
      tts: new TTS({ model: "bulbul:v3", apiKey: sarvamKey, targetLanguageCode: language, speaker: process.env.SARVAM_SPEAKER || "shubh" }),
    });
    const agent = new voice.Agent({ instructions });
    await session.start({ agent, room: ctx.room });
    const opening = `Hello, I am Disha calling for a merchant. The merchant approved this supplier order for ${order.supplierName}: ${lines}. The estimated total is INR ${order.orderTotal}. Can you confirm whether you can supply this exact order?`;
    await session.say(opening, { allowInterruptions: true }).waitForPlayout();
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: process.env.LIVEKIT_AGENT_NAME || "disha-supplier-caller" }));
}
