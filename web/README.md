# Disha

A proactive copilot for a kirana shop. The deterministic engines remain the source of truth for every number, while the LLM only narrates verified facts. The interface is intentionally labelled **Sandbox data** until live merchant adapters are configured.

## AI provider configuration

The server supports provider factories so the app can switch providers without changing routes:

- LLM: `LLM_PROVIDER=gateway` (default) or `LLM_PROVIDER=openrouter`, with `GATEWAY_MODEL` or `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`.
- TTS: `TTS_PROVIDER=elevenlabs` with `ELEVENLABS_API_KEY`/`ELEVENLABS_VOICE_ID`, or `TTS_PROVIDER=sarvam` with `SARVAM_API_KEY` and optional `SARVAM_SPEAKER`.
- `POST /api/narrate` uses the selected LLM and keeps deterministic validation plus fallback text.
- `POST /api/tts` accepts `{ "text": "...", "language": "en" | "te" }` and returns audio from the selected TTS provider.
- Voice replies now include an accessible audio player; if provider audio is not configured, the browser's device voice is used when available. Speech recognition exposes the typed composer after two failures.

Provider keys are server-only. If an optional provider is not configured, narration falls back safely and TTS returns a clear 503 instead of pretending audio was generated.

## Run locally

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. The app reads environment variables from `web/.env.local` (not the repository-root `.env.local`). A starter `web/.env.local` is included with placeholders; replace every `YOUR_...` and `PASTE_...` value before using the connected features. Without Supabase values, the app starts and shows the sign-in page, but authentication and workspace actions are unavailable. To connect Supabase, fill in the project values from **Supabase → Project Settings → API**:

- `NEXT_PUBLIC_SUPABASE_URL`: project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`): publishable/anon key; safe for browser use.
- `SUPABASE_URL`: the same project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: service-role key; server-only, never expose it to the browser or commit it.
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`: `http://localhost:3000/auth/callback` for local auth.

### OpenRouter and Sarvam setup

1. Create an OpenRouter account at [openrouter.ai](https://openrouter.ai), open **Keys**, create a key, and store it as `OPENROUTER_API_KEY` (or as the existing Windows user variable `OPENROUTER`). Do not add `Bearer` to the environment value.
2. The project uses `openrouter/free`, OpenRouter's free-model router. It automatically chooses an available free model. Free models have rate limits and availability can change; see [OpenRouter free models](https://openrouter.ai/models?pricing=free) for current options. To pin a specific free model, replace it with a currently listed model ending in `:free`.
3. Create a Sarvam account at [dashboard.sarvam.ai](https://dashboard.sarvam.ai), create or copy an API key, and store it as `SARVAM_API_KEY` (or as the existing Windows user variable `SARVAM`).
4. Keep these provider selections:

```env
LLM_PROVIDER=openrouter
TTS_PROVIDER=sarvam
```

5. Restart the dev server after changing `.env.local`; Next.js reads environment variables when the server starts.

`OPENROUTER_SITE_URL` is optional attribution metadata for OpenRouter. It is not a secret, API key, Supabase URL, or provider dashboard URL. For this local app, `http://localhost:3000` is correct; you may remove the line and the app will still work. In production, use your deployed website URL instead. The application uses OpenRouter for `/api/narrate` and Sarvam for `/api/tts`. Both routes require a signed-in Supabase workspace. If either key is missing or invalid, narration uses its deterministic fallback and TTS returns a provider error.

Run all SQL migrations in `supabase/migrations` in Supabase before creating a workspace. Run them in filename order, starting with `20261113_base_disha_schema.sql`; this creates the base tables, permissions, and demo row required by the later tenant/phase-2 migrations. If Supabase reports a stale schema cache after running them, wait briefly or reload the API schema from the Supabase dashboard. Configure the Supabase Auth email provider, or enable Google and add `http://localhost:3000/auth/callback` as a redirect URL if you use Google sign-in.

Seeded analytics and deterministic fallbacks are available without a model call. Optional narration uses the Vercel AI Gateway and falls back safely if unavailable; OpenRouter and TTS credentials are listed in `.env.example`.

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
