import "server-only";

import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { ChatOpenRouter } from "@langchain/openrouter";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { validateNarration } from "@/lib/engine-core";
import { DishaApiError } from "@/lib/disha/http";
import { createMerchantDataTools } from "./tools";

function openRouterKey() {
  return process.env.OPENROUTER_API_KEY?.trim() || process.env.OPENROUTER?.trim();
}

function messageText(message: AIMessage) {
  if (typeof message.content === "string") return message.content.trim();
  return message.content.flatMap((part) => typeof part === "string" ? [part] : "text" in part && typeof part.text === "string" ? [part.text] : []).join(" ").trim();
}

export async function answerMerchantQuestion(input: { merchantId: string; question: string; language: "en" | "te" }) {
  const apiKey = openRouterKey();
  if (!apiKey) throw new DishaApiError("OpenRouter is not configured on the server.", 503);

  const tools = createMerchantDataTools(input.merchantId);
  const model = new ChatOpenRouter({
    apiKey,
    model: process.env.OPENROUTER_AGENT_MODEL ?? process.env.OPENROUTER_MODEL ?? "openrouter/free",
    temperature: 0,
    maxTokens: 500,
    provider: { sort: "latency", allow_fallbacks: true, data_collection: "deny" },
    siteUrl: process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
    siteName: "Disha",
  }).bindTools(tools);
  const agent = createReactAgent({
    llm: model,
    tools,
    prompt: [
      "You are Disha, an assistant for a small merchant. Answer questions only from the authenticated merchant's records returned by your tools.",
      "Call the relevant read-only tool before making any claim about bills, sales, customers, or inventory. You may call multiple tools when needed.",
      "Never invent, estimate, or calculate business facts yourself. Do not claim data exists if tools return no records. Explain when a data category has not been uploaded yet.",
      "Never mutate records, send messages, approve purchases, or make financial eligibility decisions. If the user asks for a change, explain that a separate review and explicit approval are required.",
      `Respond in ${input.language === "te" ? "Telugu" : "English"}, briefly and plainly. Do not include numbers unless they appear in tool results.`,
    ].join(" "),
    name: "disha_merchant_data_assistant",
  });

  let result;
  try {
    result = await agent.invoke({ messages: [new HumanMessage(input.question)] }, { recursionLimit: 8 });
  } catch {
    throw new DishaApiError("Disha could not read the merchant data just now. Try again shortly.", 503);
  }

  const messages = result.messages;
  const usedTools = Array.from(new Set(messages.filter((message): message is ToolMessage => message instanceof ToolMessage).map((message) => message.name).filter(Boolean)));
  const toolFacts = messages.filter((message): message is ToolMessage => message instanceof ToolMessage).flatMap((message) => {
    if (typeof message.content !== "string") return [];
    try { return [JSON.parse(message.content) as unknown]; } catch { return []; }
  });
  const response = [...messages].reverse().find((message): message is AIMessage => message instanceof AIMessage && !message.tool_calls?.length);
  const answer = response ? messageText(response) : "";

  if (!usedTools.length || !answer || !validateNarration(answer, toolFacts).valid) {
    return {
      answer: input.language === "te"
        ? "మీ నమోదుల నుంచి ఈ సమాధానాన్ని నిర్ధారించలేకపోయాను. దయచేసి మరోసారి స్పష్టంగా అడగండి."
        : "I couldn't verify that answer from your records. Please try asking in a more specific way.",
      usedTools,
      fallbackUsed: true,
    };
  }

  return { answer, usedTools, fallbackUsed: false };
}
