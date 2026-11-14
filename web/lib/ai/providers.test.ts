import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateOpenRouterText, generateOpenRouterVision, selectedLlmProvider, selectedTtsProvider, synthesizeSpeech } from "./providers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("server AI provider adapters", () => {
  it("uses the OPENROUTER alias for provider selection and authorization", async () => {
    vi.stubEnv("LLM_PROVIDER", "openrouter");
    vi.stubEnv("OPENROUTER", "test-openrouter-key");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(selectedLlmProvider()).toBe("openrouter");
    await generateOpenRouterText({ system: "system", prompt: "facts" });
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect((request.headers as Record<string, string>).Authorization).toBe("Bearer test-openrouter-key");
    expect(JSON.parse(String(request.body)).provider).toEqual({ sort: "latency", allow_fallbacks: true });
  });

  it("sends inventory photos to the configured OpenRouter vision model as a data URL", async () => {
    vi.stubEnv("OPENROUTER", "test-openrouter-key");
    vi.stubEnv("OPENROUTER_VISION_MODEL", "openrouter/free");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"items":[]}' } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await generateOpenRouterVision({ system: "Extract inventory", prompt: "Read rows", imageDataUrl: "data:image/png;base64,aGVsbG8=" });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body));
    expect(body.model).toBe("openrouter/free");
    expect(body.messages[1].content).toEqual([
      { type: "text", text: "Read rows" },
      { type: "image_url", image_url: { url: "data:image/png;base64,aGVsbG8=" } },
    ]);
  });

  it("sends Sarvam's current REST request contract and decodes WAV audio", async () => {
    vi.stubEnv("TTS_PROVIDER", "sarvam");
    vi.stubEnv("SARVAM_API_KEY", "test-sarvam-key");
    vi.stubEnv("SARVAM_TTS_MODEL", "bulbul:v3");
    vi.stubEnv("SARVAM_SPEAKER", "shubh");
    const wav = Buffer.from("RIFF-sandbox-audio").toString("base64");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ audios: [wav] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(selectedTtsProvider()).toBe("sarvam");
    const result = await synthesizeSpeech({ text: "నమస్కారం", language: "te" });
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.sarvam.ai/text-to-speech");
    expect(JSON.parse(String(request.body))).toMatchObject({ text: "నమస్కారం", language_code: "te-IN", speaker: "shubh", model: "bulbul:v3", output_audio_codec: "wav" });
    expect(result?.contentType).toBe("audio/wav");
    expect(Buffer.from(new Uint8Array(result!.body)).toString()).toBe("RIFF-sandbox-audio");
  });
});
