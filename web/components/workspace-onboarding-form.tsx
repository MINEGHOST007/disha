"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function WorkspaceOnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const normalizedName = name.trim();
    if (!normalizedName || normalizedName.length > 120) {
      setError("Enter a shop name up to 120 characters.");
      return;
    }
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: createError } = await supabase.rpc("disha_create_workspace", { p_name: normalizedName });
    if (createError) {
      setBusy(false);
      setError("We could not create your workspace. Please try again.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="onboarding-page">
      <form className="onboarding-card" onSubmit={submit}>
        <p className="onboarding-eyebrow">DISHA · FIRST-TIME SETUP</p>
        <h1>Set up your shop workspace</h1>
        <p className="onboarding-copy">Your workspace is private to your team. You’ll be its owner and can invite other roles later.</p>
        <label htmlFor="shop-name">Shop name</label>
        <input id="shop-name" autoComplete="organization" maxLength={120} required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Suresh General Store" />
        {error && <p className="onboarding-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Creating workspace…" : "Create workspace"}</button>
        <p className="onboarding-note">This creates your private merchant workspace. You can import your bills and add inventory after setup.</p>
      </form>
    </main>
  );
}
