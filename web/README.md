# Disha

A proactive copilot for a kirana shop. The deterministic engines remain the source of truth for every number, while the LLM only narrates verified facts. The interface is intentionally labelled **Sandbox data** until live merchant adapters are configured.

## AI provider configuration

The server supports provider factories so the app can switch providers without changing routes:

- LLM: `LLM_PROVIDER=gateway` (default) or `LLM_PROVIDER=openrouter`, with `GATEWAY_MODEL` or `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`.
- TTS: `TTS_PROVIDER=elevenlabs` with `ELEVENLABS_API_KEY`/`ELEVENLABS_VOICE_ID`, or `TTS_PROVIDER=sarvam` with `SARVAM_API_KEY` and optional `SARVAM_SPEAKER`.
- `POST /api/narrate` uses the selected LLM and keeps deterministic validation plus fallback text.
- `POST /api/tts` accepts `{ "text": "...", "language": "en" | "te" }` and returns audio from the selected TTS provider.

Provider keys are server-only. If an optional provider is not configured, narration falls back safely and TTS returns a clear 503 instead of pretending audio was generated.

## Run locally

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. Seeded analytics and deterministic fallbacks are available without a model call. Supabase-backed actions require the connected project configuration; optional narration uses the Vercel AI Gateway and falls back safely if unavailable.

## Checks

```bash
npm test
npm run seed:check
npm run eval
```

`seed:check` prints the fixed checksum and the three worked examples. `eval` reports deterministic seed, reconciliation, customer, inventory, voice-intent, narration-safety, and cash-flow hold-out results. It exits non-zero when a scorecard target is missed; the current cash-flow hold-out is above target. See [LIMITATIONS.md](./LIMITATIONS.md) for production constraints.

## 60-second demo

1. Open **Today** and review the three sandbox priorities.
2. Open **Bills** and inspect the ₹27 digit-swap example (₹96 expected vs ₹69 recorded).
3. Open **Customers** and review Lakshmi's potentially-at-risk case; reveal the balance only when demonstrating that control.
4. Open **Stock** and move the demo slider from 5 to 12. The forecast changes from about 1.9 to 4.7 days and the suggested reorder from 24 to 18 jars.
5. Adjust the optional festival multiplier on **Stock** and see the stock-out forecast respond; it starts off at 1.00×.
6. Add a synthetic bill on **Stock** and watch sales, inventory, cash-flow, and audit figures update.
7. Open **Cash flow** to review the 30-day weekday-mean forecast, uncertainty band, and 7-day hold-out result.
8. Create a reorder draft or review the activity surface to demonstrate the approval flow. No real order or message is sent.
9. Use **Reset demo** to return to the initial state.

## Data and safety

Every displayed value is synthetic. Never enter real merchant or customer data. Purchasing, messaging, and consequential actions are not connected to external systems. See [LIMITATIONS.md](./LIMITATIONS.md) before presenting this as anything beyond a prototype.
