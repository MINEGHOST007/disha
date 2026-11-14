import { NextResponse } from "next/server";
import { apiErrorResponse, DishaApiError } from "@/lib/disha/http";
import { requireRole } from "@/lib/supabase/authz";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const MAX_BYTES=15*1024*1024;
export async function POST(request:Request){
  try{
    await requireRole();const key=process.env.SARVAM_API_KEY?.trim()||process.env.SARVAM?.trim();if(!key)throw new DishaApiError("Sarvam speech recognition is not configured.",503);
    const form=await request.formData();const file=form.get("file");if(!(file instanceof File)||!file.size||file.size>MAX_BYTES)throw new DishaApiError("Choose a voice recording smaller than 15 MB.",413);
    const supported=new Set(["audio/wav","audio/x-wav","audio/mpeg","audio/mp3","audio/aac","audio/flac","audio/ogg"]);if(!supported.has(file.type))throw new DishaApiError("Use a WAV, MP3, AAC, FLAC or OGG recording.",415);
    const upstream=new FormData();upstream.set("file",new Blob([await file.arrayBuffer()],{type:file.type}),file.name||"voice.wav");upstream.set("model",process.env.SARVAM_STT_MODEL?.trim()||"saaras:v4");upstream.set("mode","transcribe");
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
    try{const response=await fetch("https://api.sarvam.ai/speech-to-text",{method:"POST",headers:{"api-subscription-key":key},body:upstream,signal:controller.signal});if(!response.ok){console.error("Sarvam STT returned",response.status);throw new DishaApiError("Sarvam could not transcribe this recording. Try again or type your question.",502);}const result=await response.json() as {transcript?:unknown;language_code?:unknown};const transcript=typeof result.transcript==="string"?result.transcript.trim():"";if(!transcript||transcript.length>600)throw new DishaApiError("No clear speech was found. Try a shorter recording.",422);return NextResponse.json({transcript,languageCode:typeof result.language_code==="string"?result.language_code:null},{headers:{"Cache-Control":"no-store"}});}finally{clearTimeout(timeout);}
  }catch(error){return apiErrorResponse(error);}
}
