# Disha

A sandbox prototype of a proactive copilot for a kirana shop. It demonstrates a deterministic 90-day ledger, 30-customer cohort, 15-SKU catalog, a three-card daily briefing, and merchant-approved demo actions. The interface is intentionally labelled **Sandbox data** and does not connect to Paytm, WhatsApp, or a live merchant system.

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

`seed:check` prints the fixed checksum and the three worked examples. `eval` reports the deterministic seed, reconciliation, customer, inventory, voice-intent, and narration-safety acceptance checks; cash-flow forecasting remains Phase 2. See [LIMITATIONS.md](./LIMITATIONS.md) for production constraints.

## 60-second demo

1. Open **Today** and review the three sandbox priorities.
2. Open **Bills** and inspect the ₹27 digit-swap example (₹96 expected vs ₹69 recorded).
3. Open **Customers** and review Lakshmi's potentially-at-risk case; reveal the balance only when demonstrating that control.
4. Open **Stock** and move the demo slider from 5 to 12. The forecast changes from about 1.9 to 4.7 days and the suggested reorder from 24 to 18 jars.
5. Create a reorder draft or review the activity surface to demonstrate the prototype approval flow. No real order or message is sent.
6. Use **Reset demo** to return to the initial state.

## Data and safety

Every displayed value is synthetic. Never enter real merchant or customer data. Purchasing, messaging, and consequential actions are not connected to external systems. See [LIMITATIONS.md](./LIMITATIONS.md) before presenting this as anything beyond a prototype.
