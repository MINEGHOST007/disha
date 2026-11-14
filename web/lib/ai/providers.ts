import "server-only";

export type LlmProvider = "openrouter" | "gateway";
export type TtsProvider = "elevenlabs" | "sarvam";

function openRouterKey() {
  return process.env.OPENROUTER_API_KEY ?? process.env.OPENROUTER;
}

function sarvamKey() {
  return process.env.SARVAM_API_KEY ?? process.env.SARVAM;
}

export function selectedLlmProvider(): LlmProvider {
  return process.env.LLM_PROVIDER === "openrouter" && openRouterKey() ? "openrouter" : "gateway";
}

export function selectedTtsProvider(): TtsProvider | null {
  if (process.env.TTS_PROVIDER === "elevenlabs" && process.env.ELEVENLABS_API_KEY) return "elevenlabs";
  if (process.env.TTS_PROVIDER === "sarvam" && sarvamKey()) return "sarvam";
  return null;
}

export async function generateOpenRouterText(input: { system: string; prompt: string; model?: string; timeoutMs?: number }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 3000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://disha.app", "X-Title": "Disha" },
      body: JSON.stringify({ model: input.model ?? process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini", temperature: 0, messages: [{ role: "system", content: input.system }, { role: "user", content: input.prompt }], response_format: { type: "json_object" } }),
    });
    if (!response.ok) throw new Error(`OpenRouter request failed: ${response.status}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return payload.choices?.[0]?.message?.content ?? null;
  } finally { clearTimeout(timeout); }
}

export async function synthesizeSpeech(input: { text: string; language: "en" | "te"; voiceId?: string }) {
  const provider = selectedTtsProvider();
  if (!provider) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    if (provider === "elevenlabs") {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${input.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM"}`, { method: "POST", signal: controller.signal, headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json", Accept: "audio/mpeg" }, body: JSON.stringify({ text: input.text, model_id: process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2", output_format: "mp3_44100_128" }) });
      if (!response.ok) throw new Error(`ElevenLabs request failed: ${response.status}`);
      const body = await response.arrayBuffer();
      if (body.byteLength === 0 || body.byteLength > 10_000_000) throw new Error("ElevenLabs audio size is invalid");
      return { body, contentType: "audio/mpeg", provider };
    }
    const response = await fetch("https://api.sarvam.ai/text-to-speech", { method: "POST", signal: controller.signal, headers: { "api-subscription-key": sarvamKey()!, "Content-Type": "application/json" }, body: JSON.stringify({ inputs: [input.text], target_language_code: input.language === "te" ? "te-IN" : "en-IN", speaker: process.env.SARVAM_SPEAKER ?? "meera", model: process.env.SARVAM_TTS_MODEL ?? "bulbul:v2" }) });
    if (!response.ok) throw new Error(`Sarvam request failed: ${response.status}`);
    const payload = await response.json() as { audios?: string[] };
    const encoded = payload.audios?.[0];
    if (!encoded || encoded.length > 14_000_000) throw new Error("Sarvam audio size is invalid");
    const body = Buffer.from(encoded, "base64");
    if (body.byteLength === 0 || body.byteLength > 10_000_000) throw new Error("Sarvam audio size is invalid");
    return { body, contentType: "audio/wav", provider };
  } finally {
    clearTimeout(timeout);
  }
}
