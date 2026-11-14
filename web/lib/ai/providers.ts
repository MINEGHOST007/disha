import "server-only";

export type LlmProvider = "openrouter" | "gateway";
export type TtsProvider = "elevenlabs" | "sarvam";

function openRouterKey() {
  return process.env.OPENROUTER_API_KEY?.trim() || process.env.OPENROUTER?.trim();
}

function sarvamKey() {
  return process.env.SARVAM_API_KEY?.trim() || process.env.SARVAM?.trim();
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
  const apiKey = openRouterKey();
  if (!apiKey) throw new Error("OpenRouter is not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 3000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000", "X-Title": "Disha" },
      body: JSON.stringify({ model: input.model ?? process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini", temperature: 0, provider: { sort: "latency", allow_fallbacks: true }, messages: [{ role: "system", content: input.system }, { role: "user", content: input.prompt }], response_format: { type: "json_object" } }),
    });
    if (!response.ok) throw new Error(`OpenRouter request failed: ${response.status}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return payload.choices?.[0]?.message?.content ?? null;
  } finally { clearTimeout(timeout); }
}

export async function generateOpenRouterVision(input: {
  system: string;
  prompt: string;
  imageDataUrl: string;
  model?: string;
  timeoutMs?: number;
}) {
  const apiKey = openRouterKey();
  if (!apiKey) throw new Error("OpenRouter is not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 20_000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
        "X-Title": "Disha",
      },
      body: JSON.stringify({
        model: input.model ?? process.env.OPENROUTER_VISION_MODEL ?? "openrouter/free",
        temperature: 0,
        max_tokens: 1200,
        provider: { sort: "latency", allow_fallbacks: true, data_collection: "deny" },
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: [
            { type: "text", text: input.prompt },
            { type: "image_url", image_url: { url: input.imageDataUrl } },
          ] },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) throw new Error(`OpenRouter vision request failed: ${response.status}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return payload.choices?.[0]?.message?.content ?? null;
  } finally {
    clearTimeout(timeout);
  }
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
    const apiKey = sarvamKey();
    if (!apiKey) throw new Error("Sarvam is not configured");
    const model = process.env.SARVAM_TTS_MODEL ?? "bulbul:v3";
    const speaker = process.env.SARVAM_SPEAKER ?? "shubh";
    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      signal: controller.signal,
      headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ text: input.text, language_code: input.language === "te" ? "te-IN" : "en-IN", speaker, model, output_audio_codec: "wav" }),
    });
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
