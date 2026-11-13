# Disha prototype limitations

Disha is a synthetic sandbox prototype, not a production merchant assistant. Its deterministic seed contains a 90-day ledger, 30 customer profiles, and 15 SKUs. The approval state, proposals, and append-only audit history persist in the connected Supabase project; the larger ledger and cohort are regenerated from a fixed seed. No action reaches a live ledger, customer, supplier, or payment system.

## Implemented

- The E1–E5 reconciliation cases: E1–E4 are flagged for review, while E5 is suppressed by its approved discount.
- Ten at-risk, fifteen active, and five new customers, with the worked Lakshmi example and interval-based segment calculations.
- Forecasts for all 15 SKUs, including the 72-unit Ghee velocity example and dynamic stock edits.
- Supabase-backed proposals, explicit approval/rejection, demo reset, and append-only audit history.
- English and Telugu rule-based intent tests, Telugu digit normalization, and absolute-versus-incremental stock changes.
- `GET /api/briefing` and `POST /api/narrate`. Narration uses the Vercel AI Gateway with a three-second timeout, structured output, a deterministic template fallback, and numeric validation. Model facts omit customer names and balances.

## Still limited to the prototype

- Browser speech recognition varies by browser and device; the typed fallback is available, but a cross-browser Telugu speech evaluation has not been completed.
- The cash-flow forecast is a deterministic synthetic estimate: bill receipts minus inventory cost, without rent, payroll, taxes, or live account balances. The fixed-seed 7-day hold-out error is 25.3%, above the SRS target of 10%; the UI and scorecard report that honestly. It is not a production financial forecast.
- Festival uplift is a manually selected scenario multiplier, off by default. It is not inferred from a festival calendar or real demand signals.
- There is no authentication or per-merchant tenant isolation. Supabase state is a shared synthetic demo; do not use real merchant records without adding authentication, tenant-scoped queries, and rate limits.
- WhatsApp delivery, payment/POS/Paytm integrations, and live customer or supplier data are intentionally not connected.
- The deterministic evaluation is a fixture acceptance check, not a statistically representative hold-out study.

All displayed data is synthetic. Do not enter real customer information or use this prototype to make purchasing or financial decisions.
