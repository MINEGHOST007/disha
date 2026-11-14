"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "./auth.css";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true); setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback` } });
    if (error) { setBusy(false); setMessage("Google sign-in is unavailable. Check the Google provider configuration."); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const supabase = createClient();
    const result = mode === "sign-in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback` } });
    setBusy(false);
    if (result.error) { setMessage(mode === "sign-in" ? "Invalid email or password." : result.error.message); return; }
    if (mode === "sign-up") { setMessage("Check your email to confirm your account."); return; }
    router.replace("/");
    router.refresh();
  }

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f4faff" }}><form onSubmit={submit} style={{ width: "min(420px, 100%)", background: "white", padding: 28, borderRadius: 18, border: "1px solid #d9eaf3" }}><p style={{ color: "#007ab8", fontWeight: 700, letterSpacing: ".12em", fontSize: 11 }}>DISHA</p><h1>{mode === "sign-in" ? "Welcome back" : "Create your shop account"}</h1><p style={{ color: "#647488" }}>Secure access to your merchant workspace.</p><label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button disabled={busy} type="submit">{busy ? "Working…" : mode === "sign-in" ? "Sign in" : "Create account"}</button>{mode === "sign-in" && <><div className="auth-divider"><span>or</span></div><button className="google-button" disabled={busy} type="button" onClick={signInWithGoogle}><span aria-hidden="true">G</span> Continue with Google</button></>}{message && <p role="status">{message}</p>}<button type="button" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>{mode === "sign-in" ? "Create an account" : "Already have an account? Sign in"}</button></form></main>;
}
