import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateNarration } from "@/lib/engines";
import { getBriefingCard } from "@/lib/disha/briefing";
import { apiErrorResponse, DishaApiError, readJson } from "@/lib/disha/http";
import { getDashboardSnapshot } from "@/lib/disha/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  cardId: z.enum(["billing", "retention", "inventory"]),
  language: z.enum(["en", "te"]).default("en"),
}).strict();

const outputSchema = z.object({
  narration: z.string().trim().min(1).max(280),
});

const requestWindows = new Map<string, { startedAt: number; count: number }>();
const REQUEST_LIMIT = 10;
const WINDOW_MS = 60_000;

function allowNarrationRequest(request: Request) {
  const now = Date.now();
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 96)
    || request.headers.get("x-real-ip")?.trim().slice(0, 96)
    || "anonymous";
  let window = requestWindows.get(clientKey);
  if (!window || now - window.startedAt >= WINDOW_MS) {
    window = { startedAt: now, count: 0 };
    requestWindows.set(clientKey, window);
  }
  if (window.count >= REQUEST_LIMIT) return false;
  window.count += 1;
  if (requestWindows.size > 500) {
    requestWindows.forEach((value, key) => {
      if (now - value.startedAt >= WINDOW_MS) requestWindows.delete(key);
    });
  }
  return true;
}

const configuredSystemPrompt = [process.env.SYSTEM_PROMPT, process.env.SYSTEM_PROMPT_2]
  .filter((value): value is string => Boolean(value?.trim()) && (value?.trim().length ?? 0) > 40);
const configuredOutputContracts = [process.env.OUTPUT_SCHEMA, process.env.OUTPUT_SCHEMA_2]
  .filter((value): value is string => Boolean(value?.trim()) && (value?.trim().length ?? 0) > 20);
const forbiddenPhrases = (process.env.FORBIDDEN_PHRASES ?? "")
  .split(/[,;\n]/).map((phrase) => phrase.trim()).filter((phrase) => phrase.length > 2);
const instructions = [
  ...configuredSystemPrompt,
  ...configuredOutputContracts.map((contract) => `Follow this output contract: ${contract}`),
  "You narrate verified facts for a neighborhood shop owner.",
  "Use only the provided facts. Do not calculate, infer, or add numbers, names, eligibility, or details.",
  "Use the requested language and at most three short, plain sentences.",
  "Do not promise loans, guaranteed outcomes, or financial approval.",
  forbiddenPhrases.length ? `Never use these phrases: ${forbiddenPhrases.join(", ")}.` : "",
  "Return only the requested structured output.",
].filter(Boolean).join(" ");

function includesForbiddenPhrase(candidate: string) {
  const normalized = candidate.toLocaleLowerCase();
  return forbiddenPhrases.some((phrase) => normalized.includes(phrase.toLocaleLowerCase()));
}

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new DishaApiError("Choose a valid briefing card and language.", 400);
    if (!allowNarrationRequest(request)) throw new DishaApiError("Narration is temporarily rate limited. Try again in a minute.", 429);

    const snapshot = await getDashboardSnapshot();
    const card = getBriefingCard(snapshot.state, parsed.data.cardId, parsed.data.language);
    if (!card) throw new DishaApiError("That briefing card could not be found.", 404);

    try {
      const result = await generateText({
        model: "google/gemini-3.8-flash",
        instructions,
        output: Output.object({ schema: outputSchema }),
        prompt: JSON.stringify({ language: parsed.data.language, facts: card.facts }),
        timeout: { totalMs: 3000 },
        maxOutputTokens: 120,
      });
      const narration = result.output.narration.trim();
      if (validateNarration(narration, card.facts).valid && !includesForbiddenPhrase(narration)) {
        return NextResponse.json({ cardId: card.id, narration, fallbackUsed: false }, {
          headers: { "Cache-Control": "no-store" },
        });
      }
    } catch {
      // The deterministic template below is the safe response when generation fails or times out.
    }

    return NextResponse.json({ cardId: card.id, narration: card.narration, fallbackUsed: true }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
