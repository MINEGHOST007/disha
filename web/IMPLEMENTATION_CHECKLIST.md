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
- [x] Run tests (26 passing), lint, production build, and local HTTP smoke checks: sign-in redirect 307, auth page 200, tools route 200, protected STT route 401 without a session.
- [x] Verify live OpenRouter inference and tool calling with a tool-capable model, plus Sarvam TTS→STT (HTTP 200; phrase transcribed; no merchant data sent).
- [x] Verify Sarvam Vision OCR with a one-line synthetic invoice: job completed and extracted the test bill number, total and one item; nothing was saved to a merchant workspace.
- [ ] Verify signed-in workspace flows and Sarvam STT with a merchant login and real speech sample.
- [ ] Verify an outbound supplier call after LiveKit credentials and an outbound SIP trunk are configured.

## External setup needed for live integrations

- [x] Migration 119 confirmed by merchant in the connected Supabase project.
- [ ] Configure LiveKit URL/API key/API secret, an outbound SIP trunk ID/provider number, and start the Disha caller worker. Credentials are absent locally.

## Current limits

- LiveKit URL/API credentials and an outbound SIP trunk are absent locally, so an actual supplier call cannot be exercised here.
- OpenRouter inference and Sarvam TTS returned HTTP 200 on minimal generic requests. No merchant data was sent. Signed-in UI flows and Sarvam STT still need an authenticated session and speech sample.
- Migrations 115–119 are applied. Migration 119 aligns database invoice validation with the UI’s ₹1 rounding tolerance.
- The app does not substitute sample merchant data when a workspace is empty.
