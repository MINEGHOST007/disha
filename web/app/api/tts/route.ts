import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, apiErrorResponse, DishaApiError } from "@/lib/disha/http";
import { synthesizeSpeech } from "@/lib/ai/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ text: z.string().trim().min(1).max(1000), language: z.enum(["en", "te"]).default("en"), voiceId: z.string().trim().max(100).optional() }).strict();

export async function POST(request: Request) {
  try {
    const input = schema.safeParse(await readJson(request));
    if (!input.success) throw new DishaApiError("Provide text and a supported language.", 400);
    const audio = await synthesizeSpeech(input.data);
    if (!audio) throw new DishaApiError("TTS is not configured. Set TTS_PROVIDER and its provider key.", 503);
    return new NextResponse(audio.body, { headers: { "Content-Type": audio.contentType, "Cache-Control": "private, no-store", "X-TTS-Provider": audio.provider } });
  } catch (error) { return apiErrorResponse(error); }
}
