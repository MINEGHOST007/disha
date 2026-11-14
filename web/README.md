# Disha

Disha is a standalone merchant workspace. Merchants bring their own sales bills and inventory; Disha has no Paytm/POS connector and does not seed merchant workspaces with sample records. Test fixtures remain in the test and evaluation scripts only.

## What works

- Email/password sign-in and private Supabase merchant workspaces.
- Sales bill import from the included CSV template. Bill rows are grouped by date and bill number and saved to the signed-in merchant's workspace.
- Manual inventory entry or inventory-photo extraction through OpenRouter. Extracted values are editable and require merchant confirmation before saving. Uploaded images are sent to OpenRouter for extraction and are not stored by Disha.
- A LangGraph tool-calling assistant with read-only, tenant-scoped tools for sales summaries, bill search, inventory, customer visit/spend summaries, sales velocity, and stock-out estimates. Assistant queries and tool names are written to the append-only audit log. The model has no write tools.
- Sarvam AI Telugu/English text-to-speech. Browser speech remains the fallback if Sarvam is unavailable.

## Run locally

Use Node.js 22 or newer. The app uses Next.js 16 and React 19.

1. Copy `web/.env.example` to `web/.env.local`. Set your Supabase URL and publishable key. Set `OPENROUTER_API_KEY` and `SARVAM_API_KEY`, or define them in the Windows user environment as `OPENROUTER` and `SARVAM`. Keys stay server-side.
2. In the Supabase SQL editor, apply every migration in `web/supabase/migrations` in filename order, including `20261115_live_inventory_inputs.sql`. The final migration creates live merchant bill/inventory tables, policies, audit RPCs, and retires old demo mutation functions. It leaves prior legacy workspace-state rows untouched; the current app no longer reads those rows.
3. From `web`, run:

```bash
npm install
npm run dev
```

4. Open http://localhost:3000, create an account, and create a store workspace.
5. Download the bills template, fill it with your own records, then upload it. Add inventory manually or choose a photo, review every extracted row, and confirm the save.
6. Ask Disha about the records you imported. It calls OpenRouter through LangGraph and shows which read tools it used. Consequential changes are not executed by the query agent.

The local environment may select the next free port if 3000 is already occupied. Supabase must be reachable for sign-in and saving merchant records. OpenRouter is required for tool-calling answers and photo extraction; Sarvam is required for provider-generated audio. No service-role database key is required by the app.

## Provider configuration

The sample uses `OPENROUTER_AGENT_MODEL=openrouter/free`, `OPENROUTER_VISION_MODEL=openrouter/free`, `TTS_PROVIDER=sarvam`, and Sarvam `bulbul:v3` with the `shubh` voice. Free OpenRouter routing is rate-limited and model availability can change. Override the model variables with models enabled for your account when needed.

## Checks

```bash
npm test
npm run build
npm run eval
```

The engine and scorecard scripts use fixed synthetic fixtures for repeatable testing; those fixtures are not loaded into merchant workspaces. The legacy cash-flow hold-out fixture currently measures 25.3% error against its 10% target and remains a test-only limitation.
