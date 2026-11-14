# Disha

Disha is a standalone merchant growth workspace. Merchants import their own supplier bills and transaction history. It has no Paytm connector today and does not seed merchant workspaces with example records. Supplier purchase history powers next-order estimates; Disha does not claim to know on-hand inventory or SKU sales from payment amounts.

## Features

- **Next bulk order:** import several months of supplier bills by CSV, or photograph/PDF an invoice. Sarvam Vision extracts a draft; the merchant can edit supplier, date, credit days and every line, then confirm arithmetic before saving. The deterministic forecast uses completed purchase cycles, supports quantity edits, prints order sheets, and saves drafts.
- **Cash-flow estimate:** imports merchant-provided transaction CSV records, uses successful digital collections to estimate collections by supplier credit due date, and labels the result “Digital collections only; cash sales are not visible.” No Paytm API is called.
- **Khata:** create receivables with an optional due date and optional auto-match to later successful transactions. Partial payments are supported; a fully paid item moves to Closed Khata. The transaction import is idempotent and auto-match honors configured customer aliases.
- **Customer frequency:** reports median time between successful payment dates and flags a customer for review only when the latest gap is at least 1.5 times typical.
- **Assistant and voice:** OpenRouter with LangGraph calls read-only, merchant-scoped tools for transaction lookup, collections, purchase history and forecasts, customer frequency, and Khata. Sarvam STT transcribes voice questions; Sarvam TTS speaks answers. Number validation and a safe fallback prevent unsupported amounts from being narrated.
- **Supplier caller:** after saving and explicitly approving an order, the merchant can start a LiveKit outbound call to the supplier. The voice worker reads the approved list and refers every seller change back for merchant review. Mark the order placed only after seller confirmation.
- **Audit:** merchant imports, edits, assistant tool calls, Khata changes and order/call actions are recorded in the append-only workspace audit log.

## Run locally

Use Node.js 22 or newer.

1. Copy `.env.example` to `.env.local`. Configure Supabase URL and publishable key, `OPENROUTER_API_KEY`, and `SARVAM_API_KEY`. The server also accepts the local environment aliases `OPENROUTER` and `SARVAM`. The agent defaults to `openai/gpt-4o-mini` for tool calling; set `OPENROUTER_AGENT_MODEL` to another model that supports tools. `OPENROUTER_MODEL` remains for narration, and `OPENROUTER_VISION_MODEL` is for invoice-image fallback. Keep credentials out of source control.
2. Apply the SQL migrations in `supabase/migrations` in filename order. The connected Supabase project is confirmed through migration 119. Migrations 115–119 provide purchase bills, merchant transactions, Khata and order workflows, customer aliases, and the invoice rounding tolerance. Do not run a schema dump labeled “context only.”
3. Install packages and start the web app:

   ```bash
   npm install
   npm run dev
   ```

4. Open <http://localhost:3000>, create an account and merchant workspace, then import your own supplier-bill and transaction records. CSV templates contain headers only.
5. To enable the outbound supplier caller, configure `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `LIVEKIT_SIP_TRUNK_ID`; your LiveKit account also needs an outbound SIP provider/trunk. Start the worker in another terminal:

   ```bash
   npm run caller:dev
   ```

   Set the same `LIVEKIT_AGENT_NAME` in the web app and worker environment (default `disha-supplier-caller`). Set `SARVAM_CALL_LANGUAGE` to `en-IN` or a supported Sarvam TTS language code.

The workspace remains empty until the merchant imports records. Supabase must be reachable for authentication and persistence. OpenRouter is required for assistant queries; Sarvam is required for OCR, speech transcription and provider-generated narration. A LiveKit outbound SIP trunk and credentials are needed for real telephone calls.

## CSV columns

Supplier purchase bills: `supplier_name,bill_number,bill_date,total_amount,credit_days,item_name,quantity,unit,unit_price,line_total`.

Transactions: `external_id,occurred_at,customer_name,amount,mode,status`. Use ISO timestamps including timezone and status `success`, `failed`, or `pending`. The stable `external_id` makes re-imports safe.

## Checks

```bash
npm test
npm run lint
npm run build
npm run eval
```

Test and evaluation fixtures are synthetic and are not inserted into merchant workspaces.
