# Disha prototype limitations

This is a sandbox prototype with synthetic example data, not a production merchant assistant. The briefing, bill, customer, and inventory views demonstrate the three SRS scenarios. The inventory slider recomputes the Ghee forecast deterministically; Telugu and English UI toggling, typed/voice input, and activity/approval surfaces are demonstrations.

## Not yet implemented

- The complete 90-day, 30-customer, 15-SKU deterministic seed dataset and all E1–E5 reconciliation records. The current data layer contains the planted demonstration fixtures, not the full SRS volume.
- Server API routes, JSON-backed persistence, a durable append-only audit log, and approval enforcement across server endpoints. Client-side demo state is not durable across reloads.
- A complete customer segmentation engine and the ten at-risk customer cohort; only Lakshmi's worked example is represented.
- Real speech recognition coverage on all target browsers/languages. Typed input is the fallback; Telugu voice recognition is not guaranteed.
- LLM narration and the number validator. The app is template/demo driven and makes no live model calls.
- The 10-SKU stock-out study, 10-command voice evaluation, and a statistically meaningful hold-out evaluation. `npm run eval` explicitly reports these limits rather than treating the SRS targets as achieved.
- Real WhatsApp delivery, payment/POS/Paytm integrations, and live customer or merchant data. No network action should be inferred from an approval/demo control.
- Cash-flow projection and festival uplift remain Phase 2.

All displayed data is synthetic. Do not enter real customer information or use this prototype to make purchasing or financial decisions.
