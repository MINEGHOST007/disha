# Disha implementation checklist

Scope follows the merchant's latest direction: standalone merchant-supplied data, no seeded merchant records, no Paytm API today, and no on-hand inventory ledger.

## Build order

- [x] Read the Nov 14 SRS and confirm the product scope: supplier-bill OCR and purchase-cycle forecast, transaction cash flow, voice assistant, customer frequency, and an approval-gated LiveKit supplier caller.
- [x] Baseline check: existing tests pass (19); lint passes; record current build errors before changing screens.
- [x] Check LiveKit outbound-call, Sarvam speech plugin, and OpenRouter integration requirements; install the LiveKit Node packages.
- [x] Implement deterministic purchase forecast, invoice arithmetic validation, cash-flow projection, customer-frequency and payment lookup, Khata allocation, with SRS worked-example tests.
- [x] Add migrations for merchant purchase bills, digital transactions, customer aliases, editable order drafts, Khata open/closed items, payment allocations, supplier-call state, tool audit allowlist, and append-only audit events. Merchant confirms migrations 115–119 are applied in Supabase.
- [x] Add supplier bill Sarvam OCR and CSV preview, editable merchant-confirmed bill save, transaction CSV import, Khata create/settle, agent query, order draft/approval/call/result routes, and audit reads through the page.
- [x] Replace inventory management with a mobile-first merchant workspace for Orders, Invoices, Cash flow, Transactions, Khata, Customers, Ask Disha, and Activity. Empty workspace screens do not add sample records.
- [x] Implement OpenRouter LangGraph tool calls grounded in merchant transactions, purchases, customers and Khata; Sarvam STT/TTS; deterministic amount facts and safe answer validation.
- [x] Implement an approval-gated LiveKit caller worker that reads the approved items and sends seller-proposed changes back for merchant review.
- [x] Update setup/configuration docs and remove obsolete inventory claims.
- [x] Migration 118 is applied: customer-alias writes and idempotent, alias-aware Khata auto-match are available. PostgREST probes reach its auth guards (401/42501) without changing data.
- [x] Migration 119 is applied: DB invoice arithmetic accepts the same ₹1 rounding tolerance as merchant review.
- [x] Migration 120 confirmed by the merchant; it requires seller confirmation before an order is marked placed or sent for review.
- [x] Migration 121 confirmed by the merchant; optional customer contact numbers and merchant-reviewed overdue reminder drafts are enabled.
- [x] Migration 122 confirmed by the merchant; merchant-entered GST dues and merchant-recorded full or partial payments are enabled.
- [x] Add GST due tracker UI and manager-only APIs; the tracker does not calculate tax, file returns, or submit money.
- [x] Add read-only `get_gst_summary` tool for merchant questions about recorded GST due amounts and dates.
- [ ] Apply migration 123 (`supabase/migrations/20261123_gst_agent_query_tool.sql`) to permit auditing the new GST query tool.
- [x] Add deterministic supplier recommendations from lowest latest observed invoice rates, with source date and number of suppliers compared.
- [x] Add a rerunnable, empty-workspace-only demo seed query with explicit DEMO labels and an in-app sample-data warning.
- [x] Run tests (30 passing), lint and production build; verify the local demo walkthrough pages and capture the journey screenshots.
- [x] Verify live OpenRouter inference and tool calling with a tool-capable model, plus Sarvam TTS→STT (HTTP 200; phrase transcribed; no merchant data sent).
- [x] Verify Sarvam Vision OCR with a one-line synthetic invoice: job completed and extracted the test bill number, total and one item; nothing was saved to a merchant workspace.
- [ ] Verify signed-in workspace flows and Sarvam STT with a merchant login and real speech sample.
- [ ] Verify an outbound supplier call after LiveKit credentials and an outbound SIP trunk are configured.

## External setup needed for live integrations

- [x] Migration 119 confirmed by merchant in the connected Supabase project.
- [x] Apply migration 120 in the connected Supabase project (merchant confirmation).
- [ ] Run migration 123, then optionally run `supabase/queries/seed_empty_workspaces_demo_data.sql` in the Supabase SQL editor.
- [ ] Configure LiveKit URL/API key/API secret, an outbound SIP trunk ID/provider number, and start the Disha caller worker. Credentials are absent locally.

## Current limits

- LiveKit URL/API credentials and an outbound SIP trunk are absent locally, so an actual supplier call cannot be exercised here.
- OpenRouter inference and Sarvam TTS returned HTTP 200 on minimal generic requests. No merchant data was sent. Signed-in UI flows and Sarvam STT still need an authenticated session and speech sample.
- Migrations 115–122 are applied (merchant confirmed). Migration 119 aligns database invoice validation with the UI’s ₹1 arithmetic tolerance; migration 120 adds a required seller-confirmation guard; migration 121 enables Khata contact/reminder drafts; migration 122 enables GST due and payment tracking.
- The app does not substitute sample merchant data when a workspace is empty.
