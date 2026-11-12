# Disha

A sandbox prototype of a proactive copilot for a kirana shop. It demonstrates a daily briefing, a planted bill discrepancy, Lakshmi's customer-care case, and the Ghee stock forecast. The interface is intentionally labelled **Sandbox data** and does not connect to Paytm, WhatsApp, or a live merchant system.

## Run locally

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. The UI and deterministic fixtures run without an LLM or network-backed business integration.

## Checks

```bash
npm test
npm run eval
```

The evaluator prints measured values for the current prototype fixtures and marks incomplete SRS cohorts as partial or Phase 2. It does not claim the full SRS acceptance suite is complete; see [LIMITATIONS.md](./LIMITATIONS.md).

## 60-second demo

1. Open **Today** and review the three sandbox priorities.
2. Open **Bills** and inspect the $27 digit-swap example (₹96 expected vs ₹69 recorded).
3. Open **Customers** and review Lakshmi's potentially-at-risk case; reveal the balance only when demonstrating that control.
4. Open **Stock** and move the demo slider from 5 to 12. The forecast changes from about 1.9 to 4.7 days and the suggested reorder from 24 to 18 jars.
5. Create a reorder draft or review the activity surface to demonstrate the prototype approval flow. No real order or message is sent.
6. Use **Reset demo** to return to the initial state.

## Data and safety

Every displayed value is synthetic. Never enter real merchant or customer data. Purchasing, messaging, and consequential actions are not connected to external systems. See [LIMITATIONS.md](./LIMITATIONS.md) before presenting this as anything beyond a prototype.
