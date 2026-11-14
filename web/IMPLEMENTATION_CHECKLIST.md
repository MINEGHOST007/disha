# Disha implementation checklist

Scope follows the merchant's latest direction: standalone merchant-supplied data, no seeded merchant records, no Paytm API today, and no on-hand inventory ledger.

## Build order

- [x] Read the Nov 14 SRS and confirm the product scope: supplier-bill OCR and purchase-cycle forecast, transaction cash flow, voice assistant, customer frequency, and an approval-gated LiveKit supplier caller.
- [x] Baseline check: existing tests pass (19); lint passes; record current build errors before changing screens.
- [x] Check LiveKit outbound-call, Sarvam speech plugin, and OpenRouter integration requirements; install the LiveKit Node packages.
- [x] Implement deterministic purchase forecast, invoice arithmetic validation, cash-flow projection, customer-frequency and payment lookup, Khata allocation, with SRS worked-example tests.
- [x] Add migrations for merchant purchase bills, digital transactions, customer aliases, editable order drafts, Khata open/closed items, payment allocations, supplier-call state, tool audit allowlist, and append-only audit events. Merchant confirms migrations 115, 116, and 117 are applied in Supabase.
- [x] Add supplier bill Sarvam OCR and CSV preview, editable merchant-confirmed bill save, transaction CSV import, Khata create/settle, agent query, order draft/approval/call/result routes, and audit reads through the page.
- [x] Replace inventory management with a mobile-first merchant workspace for Orders, Invoices, Cash flow, Transactions, Khata, Customers, Ask Disha, and Activity. Empty workspace screens do not add sample records.
- [x] Implement OpenRouter LangGraph tool calls grounded in merchant transactions, purchases, customers and Khata; Sarvam STT/TTS; deterministic amount facts and safe answer validation.
- [x] Implement an approval-gated LiveKit caller worker that reads the approved items and sends seller-proposed changes back for merchant review.
- [x] Update setup/configuration docs and remove obsolete inventory claims.
- [ ] Apply migration 118 for customer alias writes and idempotent, alias-aware Khata auto-match (migrations 115–117 are confirmed applied).
- [x] Run tests (26 passing), lint, production build, and local HTTP smoke checks: sign-in redirect 307, auth page 200, tools route 200, protected STT route 401 without a session.
- [ ] Verify the signed-in empty-workspace screen and live Sarvam/OpenRouter calls with a merchant login.

## External setup needed for live integrations

- [ ] Apply migration 118 in the connected Supabase project (merchant confirms migrations 115–117 are applied).
- [ ] Configure LiveKit URL/API key/API secret, an outbound SIP trunk ID/provider number, and start the Disha caller worker. Credentials are absent locally.

## Current limits

- LiveKit telephony needs a configured outbound SIP trunk and phone provider. No credentials are available here, so an actual call cannot be exercised locally yet.
- LiveKit telephony needs credentials and an outbound SIP trunk; those are absent locally, so an actual telephone call cannot be exercised here.
- OpenRouter and Sarvam credentials are configured through user environment aliases, but paid/live provider requests were not sent as part of local verification.
- Migration 118 is provided for the customer-alias save action and safe alias-based Khata auto-matching; it must be applied after 117.
- The app does not substitute sample merchant data when a workspace is empty.
