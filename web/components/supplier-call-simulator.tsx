"use client";

import { useRef, useState } from "react";
import { supplierPersonas, type DealEvaluation, type NegotiationTarget, type SupplierPersona } from "@/lib/merchant/supplier-negotiation";

type Turn = { speaker: "agent" | "supplier"; text: string; status?: string; guardrail?: string | null };
type AgentReply = { speaker: "agent"; text: string; status: "negotiating" | "agreed" | "escalate" | "ended"; evaluation: DealEvaluation | null; guardrail: string | null };
type SupplierReply = { speaker: "supplier"; text: string; endCall: boolean };

const MAX_TURNS = 20;
const rupees = (value: number) => `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function SupplierCallSimulator({ orderId, supplierName, onClose }: { orderId: string; supplierName: string; onClose: () => void }) {
  const [persona, setPersona] = useState<SupplierPersona>("hard_bargainer");
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [voice, setVoice] = useState(false);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [targets, setTargets] = useState<NegotiationTarget[]>([]);
  const [evaluation, setEvaluation] = useState<DealEvaluation | null>(null);
  const [finalStatus, setFinalStatus] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [thinking, setThinking] = useState<"agent" | "supplier" | null>(null);
  const [supplierDraft, setSupplierDraft] = useState("");
  const [error, setError] = useState("");
  const stopRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function requestTurn<T>(turn: "agent" | "supplier", history: Turn[]): Promise<T> {
    setThinking(turn);
    try {
      const response = await fetch(`/api/orders/${orderId}/simulate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turn, persona, transcript: history.map(({ speaker, text }) => ({ speaker, text: text.slice(0, 600) })) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "The simulation turn failed.");
      setTargets(data.targets);
      return data.turn as T;
    } finally { setThinking(null); }
  }

  async function speak(text: string) {
    if (!voice) { await pause(700); return; }
    try {
      const response = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.slice(0, 1000), language: "en" }) });
      if (!response.ok) { setVoice(false); setError("Voice playback is not configured; continuing as text."); return; }
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url); audioRef.current = audio;
      await new Promise<void>((resolve) => { audio.onended = () => resolve(); audio.onerror = () => resolve(); void audio.play().catch(() => resolve()); });
      URL.revokeObjectURL(url);
    } catch { await pause(700); }
  }

  /** Runs one Disha turn; returns the updated history and whether the call is over. */
  async function agentStep(history: Turn[]) {
    const reply = await requestTurn<AgentReply>("agent", history);
    const next = [...history, { speaker: "agent" as const, text: reply.text, status: reply.status, guardrail: reply.guardrail }];
    setTranscript(next);
    if (reply.evaluation) setEvaluation(reply.evaluation);
    const over = reply.status !== "negotiating";
    if (over) setFinalStatus(reply.status);
    else if (next.length >= MAX_TURNS) setFinalStatus("escalate");
    await speak(reply.text);
    return { history: next, done: over || next.length >= MAX_TURNS };
  }

  async function run(history: Turn[]) {
    setRunning(true); setError(""); stopRef.current = false;
    try {
      let state = await agentStep(history);
      while (mode === "auto" && !state.done && !stopRef.current) {
        const supplier = await requestTurn<SupplierReply>("supplier", state.history);
        const withSupplier = [...state.history, { speaker: "supplier" as const, text: supplier.text }];
        setTranscript(withSupplier);
        await speak(supplier.text);
        if (stopRef.current) break;
        state = await agentStep(withSupplier);
        if (supplier.endCall && !state.done) { setFinalStatus("escalate"); break; }
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The simulation stopped."); }
    finally { setRunning(false); }
  }

  function start() { setTranscript([]); setEvaluation(null); setFinalStatus(null); void run([]); }
  function stop() { stopRef.current = true; audioRef.current?.pause(); }
  function sendAsSupplier() {
    const text = supplierDraft.trim();
    if (!text || running) return;
    setSupplierDraft("");
    const next = [...transcript, { speaker: "supplier" as const, text }];
    setTranscript(next);
    void run(next);
  }

  const started = transcript.length > 0 || running;
  const callOver = Boolean(finalStatus);
  const outcomeLabel = evaluation?.outcome === "improved" ? "Negotiated below approved price" : evaluation?.outcome === "confirmed" ? "Confirmed at approved price" : evaluation?.outcome === "needs_review" ? "Supplier terms need your review" : finalStatus === "escalate" ? "No agreement · needs your review" : null;

  return (
    <section className="sim-panel" aria-label={`Simulated call with ${supplierName}`}>
      <div className="merchant-section-heading">
        <div><p className="merchant-eyebrow">CALL SIMULATION</p><h2>Rehearse the call with {supplierName}</h2></div>
        <span className="step-pill">NO CALL PLACED</span>
      </div>
      <p className="sim-note">Disha negotiates against an AI supplier, or you play the supplier. Nothing is dialed and the order is not changed.</p>

      <div className="sim-controls">
        <label>Supplier behaviour
          <select value={persona} disabled={started && !callOver} onChange={(event) => setPersona(event.target.value as SupplierPersona)}>
            {Object.entries(supplierPersonas).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
        </label>
        <label>Who plays the supplier
          <select value={mode} disabled={started && !callOver} onChange={(event) => setMode(event.target.value as "auto" | "manual")}>
            <option value="auto">AI supplier</option>
            <option value="manual">I will type as the supplier</option>
          </select>
        </label>
        <label className="sim-check"><input type="checkbox" checked={voice} onChange={(event) => setVoice(event.target.checked)} /> Speak turns aloud</label>
        <div className="sim-buttons">
          {running && mode === "auto" ? <button type="button" className="merchant-secondary" onClick={stop}>Stop</button> : <button type="button" className="merchant-primary" disabled={running} onClick={start}>{started ? "Restart call" : "Start simulated call"}</button>}
          <button type="button" className="merchant-secondary" onClick={() => { stop(); onClose(); }}>Close</button>
        </div>
      </div>
      {mode === "manual" && <small className="sim-note">{supplierPersonas[persona].brief} Use this as your brief.</small>}

      <div className="sim-body">
        <ol className="sim-transcript" aria-live="polite">
          {!transcript.length && !thinking && <li className="sim-empty">Start the call to hear Disha read the order and open the negotiation.</li>}
          {transcript.map((turn, index) => (
            <li key={index} className={`sim-turn sim-${turn.speaker}`}>
              <span>{turn.speaker === "agent" ? "Disha" : supplierName}{turn.status && turn.status !== "negotiating" ? ` · ${turn.status}` : ""}</span>
              <p>{turn.text}</p>
              {turn.guardrail && <small className="sim-guardrail">Guardrail: {turn.guardrail}</small>}
            </li>
          ))}
          {thinking && <li className={`sim-turn sim-${thinking} sim-typing`}><span>{thinking === "agent" ? "Disha" : supplierName}</span><p>…</p></li>}
        </ol>

        <aside className="sim-side">
          <h3>Negotiation plan</h3>
          {!targets.length ? <p className="empty-copy">Targets appear when the call starts.</p> : (
            <div className="sim-table"><table>
              <thead><tr><th>Item</th><th>Approved</th><th>Target</th></tr></thead>
              <tbody>{targets.map((line) => <tr key={line.item_name}><td>{line.item_name}<small>{line.quantity} {line.unit}{line.leverage ? ` · ${line.leverage.supplier_name} billed ${rupees(line.leverage.rate)}` : " · 3% ask"}</small></td><td>{rupees(line.ceiling)}</td><td>{rupees(line.target)}</td></tr>)}</tbody>
            </table></div>
          )}
          {outcomeLabel && (
            <div className={`sim-outcome sim-outcome-${evaluation?.outcome ?? "needs_review"}`}>
              <strong>{outcomeLabel}</strong>
              {evaluation && <span>Approved {rupees(evaluation.approvedTotal)} → deal {rupees(evaluation.dealTotal)}{evaluation.savings > 0 ? ` · saves ${rupees(evaluation.savings)}` : ""}</span>}
              {evaluation?.issues.map((issue) => <small key={issue}>{issue}</small>)}
            </div>
          )}
        </aside>
      </div>

      {mode === "manual" && started && !callOver && (
        <form className="sim-reply" onSubmit={(event) => { event.preventDefault(); sendAsSupplier(); }}>
          <input value={supplierDraft} maxLength={600} disabled={running} placeholder={`Reply as ${supplierName}…`} onChange={(event) => setSupplierDraft(event.target.value)} />
          <button type="submit" className="merchant-primary" disabled={running || !supplierDraft.trim()}>Send</button>
        </form>
      )}
      {error && <p className="sim-error" role="alert">{error}</p>}
    </section>
  );
}
