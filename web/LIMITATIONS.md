# Disha local integration status

Disha is being converted into a standalone merchant workspace. Merchants supply their own bill exports and inventory records; there is no POS, Paytm, or bank connector. Live workspaces must stay empty until a merchant imports data.

## Implemented locally

- Supabase-authenticated merchant workspace with merchant-scoped reads.
- CSV bill import and manual or photo-assisted inventory entry.
- Photo extraction through OpenRouter with merchant review before save.
- LangGraph assistant with read-only tools for sales, bills, inventory, customer purchase summaries, item velocity, and stock-out forecasts.
- Sarvam AI speech generation with browser speech fallback.
- Legacy seeded demo UI and live demo routes removed; deterministic fixtures remain in tests/evaluations only.

## Setup requirement

Apply `supabase/migrations/20261115_live_inventory_inputs.sql` in the configured Supabase project after the earlier schema migrations. Until that migration is applied, the new bill and inventory tables and RPCs do not exist, so imports, photo saves, and assistant data queries cannot work against that project. The app reports the missing schema instead of substituting sample merchant data.

## Known limits

- A live Supabase project and merchant account are required for end-to-end persistence; local environment credentials cannot apply the pending SQL migration automatically.
- OpenRouter model availability and free-tier rate limits vary. Configure an account-enabled agent and vision model for dependable use.
- Inventory photo output is an extraction suggestion and must be reviewed by the merchant.
- Speech recognition depends on browser/device support; typed questions are available.
- Legacy deterministic cash-flow fixture evaluation measures 25.3% error against its 10% target. It is a test-only limitation and is not used as live merchant data.
