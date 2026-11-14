# Disha implementation checklist

Scope follows the merchant's latest direction: standalone merchant-supplied data, no seeded merchant records, no Paytm API today, and no on-hand inventory ledger.

## Build order

- [x] Read the Nov 14 SRS and confirm the product scope: supplier-bill OCR and purchase-cycle forecast, transaction cash flow, voice assistant, customer frequency, and an approval-gated LiveKit supplier caller.
- [x] Baseline check: existing tests pass (19); lint passes; record current build errors before changing screens.
- [x] Check LiveKit outbound-call, Sarvam speech plugin, and OpenRouter integration requirements; install the LiveKit Node packages.
- [x] Implement deterministic purchase forecast, invoice arithmetic validation, cash-flow projection, customer-frequency and payment lookup, Khata allocation, with SRS worked-example tests.
- [ ] Add database migration for mapped purchase bills, merchant transactions and aliases, order drafts, Khata open/closed items and payment allocations, supplier calling, messages, and append-only audit events.
- [ ] Add bill OCR and CSV preview, merchant-confirmed bill save, forecast/order edit, print/share, cash-flow, transaction import, customer/message approval, Khata, audit, and supplier-call routes.
- [ ] Replace the old inventory page with a mobile-first merchant workspace for Orders, Cash flow, Khata, Customers, Voice, and Activity.
- [ ] Implement typed-first intent routing, OpenRouter grounded tool calls, Sarvam STT/TTS, number validation, and safe template fallbacks.
- [ ] Implement LiveKit outbound supplier agent; read the approved order exactly, record seller confirmation, and never accept seller edits without merchant review.
- [ ] Update setup/configuration docs and remove obsolete inventory claims.
- [ ] Run tests, lint, production build, route smoke checks, and verify blank workspaces stay empty.

## External setup needed for live integrations

- [ ] Apply the new Supabase migration in the connected project (database management credentials are not present in this local environment).
- [ ] Configure LiveKit URL/API key/API secret, an outbound SIP trunk ID/provider number, and start the Disha caller worker (none are present in the local environment yet).

## Current limits

- The app still renders the obsolete inventory workspace until the replacement is complete.
- The current production build fails on stale inventory database types and Sarvam Document AI SDK type mismatches.
- The app must not substitute sample merchant data when a workspace is empty.
