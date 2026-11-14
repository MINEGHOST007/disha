"use client";

import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";

export function NarrationPlayer({ text, language }: { text: string; language: "en" | "te" }) {
  const [audioUrl, setAudioUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  async function prepareAudio() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setMessage("");
    setAudioUrl("");
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload?.error === "string" ? payload.error : "Narration audio is unavailable.");
      }
      const blob = await response.blob();
      if (!blob.type.startsWith("audio/")) throw new Error("The narration provider returned an unsupported audio format.");
      setAudioUrl(URL.createObjectURL(blob));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Narration audio is unavailable.";
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        setMessage(`${reason} Using your device voice instead.`);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language === "te" ? "te-IN" : "en-IN";
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } else {
        setMessage(reason);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="narration-player">
      <button type="button" className="type-button narration-button" onClick={() => void prepareAudio()} disabled={loading || !text.trim()}>
        <Volume2 size={15} />{loading ? "Preparing audio…" : "Listen to Disha"}
      </button>
      {audioUrl && <audio controls preload="none" src={audioUrl} aria-label="Disha voice response" />}
      {message && <span role="status">{message}</span>}
    </div>
  );
}
