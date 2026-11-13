# Disha SRS Implementation Plan

## 1. Purpose and completion definition

This document defines the remaining implementation work required to move Disha from the current deterministic SRS prototype to a production-ready merchant application. The existing P0/P1 workflow, seeded dashboard, proposal review flow, Supabase tenancy foundation, authentication foundation, Google OAuth entry point, LLM factory, and TTS factory are already present. The work below completes the missing application wiring, security boundaries, real data adapters, operational safeguards, and acceptance testing.

The project is complete when:

- Every authenticated request is scoped to one merchant workspace.
- Every state-changing operation is authorized by both merchant membership and role.
- No API route uses the Supabase service-role client for user-originated reads or writes.
- Demo data is isolated from production data and cannot be mutated by ordinary users.
- Bills, inventory, suppliers, customers, proposals, audit records, and outbox events have durable schemas and migrations.
- OpenRouter, Vercel AI Gateway, ElevenLabs, and Sarvam are selected through server-side provider factories without exposing keys to the browser.
- Authentication, onboarding, RBAC, approvals, voice/TTS, failure handling, and audit behavior pass end-to-end tests.
- Production deployment has documented environment variables, migrations, monitoring, backups, and rollback procedures.

## 2. Current baseline

### Already implemented

- Next.js App Router dashboard and responsive merchant UI.
- Deterministic business engines for sales, stock, cohorts, cash signals, and proposals.
- Seeded sandbox records and explicit sandbox labeling.
- Supabase database integration and service-role-backed prototype persistence.
- Supabase email/password authentication UI and callback route.
- Google OAuth button and callback path.
- Supabase merchant and membership tables with `owner`, `manager`, and `staff` roles.
- Initial membership helper and RLS foundations.
- OpenRouter-compatible LLM adapter selected with `LLM_PROVIDER`.
- Vercel AI Gateway fallback for narration.
- ElevenLabs/Sarvam TTS adapter selected with `TTS_PROVIDER`.
- `POST /api/narrate` and `POST /api/tts` API surfaces.
- Voice intent parsing, deterministic validation, audit/proposal flows, and test coverage for the prototype.

### Known gaps

- Dashboard data access is not fully tenant-scoped yet.
- Merchant onboarding does not create a workspace and membership after signup.
- Role checks are not consistently enforced in every route.
- Existing demo/service-role paths must be replaced or isolated.
- Live bill, inventory, POS, supplier, customer, WhatsApp, and payment adapters are not connected.
- TTS is exposed as an API but is not fully wired to playback in the dashboard.
- Provider credentials are not currently present in the project environment.
- Operational controls such as rate limits, idempotency, retries, monitoring, backups, and alerting need completion.

## 3. Target architecture

```text
Browser
  -> authenticated Supabase session cookie
  -> Next.js server components / route handlers
  -> request context: userId + merchantId + role
  -> domain services
  -> authenticated Supabase client with RLS
  -> Postgres tables, views, and transactional RPCs

AI routes
  -> validated domain facts only
  -> LLM provider factory
       -> OpenRouter, when explicitly configured
       -> Vercel AI Gateway fallback
  -> schema validation
  -> deterministic fallback

TTS route
  -> validated text and language
  -> TTS provider factory
       -> ElevenLabs
       -> Sarvam AI
  -> audio response with provider metadata
```

The browser must never receive service-role credentials, provider API keys, raw database errors, or unrestricted database data. Domain engines remain deterministic and authoritative; models may summarize or narrate verified facts but may not invent balances, stock counts, prices, dates, or approval decisions.

## 4. Workstream A: schema and migrations

### A1. Inspect and freeze the current schema

- Record the exact columns, nullability, defaults, constraints, indexes, and existing RLS policies for every Disha table.
- Add migration tests that fail if a required table or policy is missing.
- Keep all changes in timestamped Supabase migrations.
- Never edit production data destructively during application rollout.

### A2. Core production tables

Create or finalize these tables:

- `disha_merchants`: merchant workspace, display name, locale, timezone, currency, status, created/updated timestamps.
- `disha_merchant_members`: merchant/user membership, role, invitation status, created/updated timestamps.
- `disha_profiles`: user display name, phone, preferred language, onboarding status.
- `disha_bills`: imported bill metadata, supplier, invoice number, invoice date, totals, source, raw import reference, processing status.
- `disha_bill_lines`: bill item, quantity, unit price, tax, normalized SKU, confidence, and review state.
- `disha_inventory`: merchant-scoped SKU stock, reorder point, unit cost, selling price, supplier, and updated timestamp.
- `disha_customers`: merchant-scoped customer profile and consent fields.
- `disha_sales`: merchant-scoped sale header and totals.
- `disha_sale_lines`: sale item, quantity, price, and normalized SKU.
- `disha_proposals`: recommendation, evidence snapshot, confidence, status, created/approved/rejected metadata.
- `disha_audit_log`: immutable actor, merchant, action, entity, before/after summary, request ID, and timestamp.
- `disha_outbox`: durable events for WhatsApp, email, supplier, and integration delivery with idempotency keys and retry state.
- `disha_integration_connections`: provider type, encrypted/reference configuration, status, and last successful sync.

### A3. Constraints and indexes

- Add foreign keys from every business row to `disha_merchants` with `on delete cascade` only where data loss is explicitly intended.
- Add unique constraints for `(merchant_id, normalized_sku)`, `(merchant_id, invoice_number, supplier_id)`, and provider event IDs.
- Add indexes on every `merchant_id`, status, created timestamp, and lookup key used by a route.
- Add check constraints for non-negative quantities, valid statuses, supported languages, and valid role values.
- Store money as integer minor units plus an explicit currency, never floating point.
- Store timestamps in UTC and render with the merchant timezone.

### A4. RLS policy design

- Enable RLS on every merchant-owned table.
- Create a single trusted membership helper with `security definer`, pinned `search_path`, and fully qualified table names.
- Read policy: user must be an active member of the row’s merchant.
- Insert policy: actor must be a member and the inserted `merchant_id` must be a merchant they can access.
- Update/delete policy: actor must have the required role; sensitive mutations should use transactional RPCs.
- Audit policy: normal users can insert audit events through a controlled function but cannot update/delete them.
- Outbox policy: users cannot directly mark delivery success; worker/RPC owns delivery state transitions.

### A5. Transactional RPCs

Create narrowly scoped SQL functions for operations that must be atomic:

- Create merchant plus first owner membership.
- Approve proposal and write audit event in one transaction.
- Reject proposal and write audit event in one transaction.
- Apply stock adjustment and write audit event in one transaction.
- Claim and complete an outbox delivery with an idempotency key.
- Import a bill and upsert normalized inventory lines atomically.

Each `security definer` function must pin `search_path = ''`, fully qualify objects, validate the actor, and return only the fields required by the caller.

## 5. Workstream B: authentication and onboarding

### B1. Session infrastructure

- Keep Supabase server and browser clients using `@supabase/ssr`.
- Refresh sessions in middleware/proxy.
- Keep auth callback handling for email confirmation and Google OAuth.
- Use generic credential errors to avoid account enumeration.
- Surface actionable email-confirmation and rate-limit messages.
- Add sign-out and session-expiry handling.

### B2. Merchant onboarding

After first successful sign-in:

1. Load the user profile and memberships.
2. If no membership exists, show the merchant creation form.
3. Create merchant and owner membership through the transactional RPC.
4. Initialize merchant preferences and empty integration settings.
5. Redirect to the dashboard with the active merchant ID in server context.

Do not allow a client to self-assign an owner role or choose another user’s membership.

### B3. Google login configuration

- Keep Google OAuth code in the app.
- Configure the provider in Supabase Auth with the exact production and preview callback URLs.
- Keep `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` for preview callback routing.
- Test signup, email confirmation, Google callback, expired session, and sign-out.

## 6. Workstream C: request context and RBAC

### C1. Request context helper

Create a server-only `getRequestContext()` helper that:

- Reads the authenticated Supabase user.
- Resolves the active merchant membership.
- Validates the requested merchant ID against membership.
- Returns `{ userId, merchantId, role, locale, timezone }`.
- Throws typed `401`, `403`, or `404` errors without leaking database details.

Every protected route must call this helper before reading or mutating data.

### C2. Permission matrix

| Capability | owner | manager | staff |
|---|---:|---:|---:|
| View dashboard and reports | yes | yes | yes |
| View inventory and bills | yes | yes | yes |
| Edit stock counts | yes | yes | limited |
| Create proposal | yes | yes | limited |
| Approve/reject consequential proposal | yes | yes | no |
| Reset demo/test data | yes | no | no |
| Manage members and integrations | yes | no | no |
| Export/delete merchant data | yes | no | no |
| View audit history | yes | yes | limited |

Enforce this matrix in server code and database policies. UI hiding is only a usability feature, never an authorization control.

### C3. API route audit

Update every route under `app/api`:

- Add request context and permission checks.
- Validate JSON with strict Zod schemas.
- Validate IDs as UUIDs or known domain identifiers.
- Scope every query by `merchant_id`.
- Reject client-supplied actor IDs and roles.
- Return stable error shapes: `{ code, message, requestId }`.
- Add audit events for every consequential mutation.
- Remove direct service-role reads/writes from user request paths.

## 7. Workstream D: data adapters and imports

### D1. Adapter contracts

Define interfaces for:

- `BillSourceAdapter`: list, fetch, normalize, acknowledge.
- `InventoryAdapter`: list, update, reconcile.
- `SalesAdapter`: daily sales and line-item history.
- `SupplierAdapter`: supplier catalog and reorder submission.
- `MessagingAdapter`: send, status, retry, opt-out.
- `PaymentAdapter`: payment status only; never store card data.

Adapters must return normalized domain objects and provider metadata. They must not leak provider-specific response shapes into UI components.

### D2. Sync jobs

- Add a durable sync job record and outbox event for every import.
- Make syncs idempotent using provider event IDs and request IDs.
- Use bounded retries with exponential backoff.
- Store rejected rows for merchant review instead of dropping them.
- Reconcile totals after every import and flag mismatches.
- Add manual re-sync controls restricted to owner/manager roles.

### D3. Sandbox isolation

- Keep seeded records in a dedicated demo merchant.
- Add an explicit environment and merchant mode to the data access layer.
- Prevent production users from reading or mutating demo rows.
- Keep the sandbox badge only for demo mode; show the actual merchant name in production.

## 8. Workstream E: AI, voice, and TTS

### E1. LLM factory

The current factory should be expanded into a typed provider interface:

```ts
interface LlmClient {
  generateJson<T>(input: {
    system: string;
    prompt: string;
    schema: ZodSchema<T>;
    model?: string;
    requestId: string;
  }): Promise<T>;
}
```

Implement:

- OpenRouter client using server-only `OPENROUTER_API_KEY`, model, timeout, and request metadata.
- Vercel AI Gateway client as the default/fallback path.
- Provider selection from validated environment configuration, not arbitrary browser input.
- Timeout, retry, structured-output validation, and deterministic fallback.
- Redaction of merchant PII from logs and provider prompts.
- Token/cost metadata in internal logs without storing sensitive prompt content.

Never let an LLM decide whether a proposal is approved, calculate money, or directly execute a mutation.

### E2. TTS factory

Implement a typed TTS contract:

```ts
interface TtsClient {
  synthesize(input: {
    text: string;
    language: "en" | "te";
    voiceId?: string;
    requestId: string;
  }): Promise<{ bytes: ArrayBuffer; contentType: string }>;
}
```

Implement:

- ElevenLabs multilingual synthesis.
- Sarvam Telugu/Indian-language synthesis.
- Provider selection from server configuration.
- Audio size limits, timeout, retry, and content-type validation.
- No provider key in client bundles or response headers.
- Browser playback with loading, error, retry, and accessible controls.
- Optional private Blob storage only if recordings must be replayed later.

### E3. Voice intent

- Keep speech recognition client-side where supported.
- Send only the transcript to the server.
- Validate intent output against a strict schema.
- Require confirmation for consequential actions.
- Show the parsed intent, affected records, and evidence before mutation.
- Add a typed fallback when browser speech recognition is unavailable.

## 9. Workstream F: frontend completion

- Add merchant onboarding and workspace switcher.
- Add role-aware navigation and disabled states with clear explanations.
- Add auth/session status and sign-out control.
- Add real loading, empty, error, retry, and stale-data states to every panel.
- Connect `/api/tts` to the voice briefing/audio player.
- Show provider and data freshness metadata where useful.
- Preserve bilingual English/Telugu copy and accessible labels.
- Keep alerts non-blocking and keyboard accessible.
- Ensure mobile layouts do not hide approval evidence or action consequences.
- Never display raw API or provider errors to merchants.

## 10. Workstream G: operational readiness

### G1. Security

- Enforce HTTPS and security headers in production.
- Confirm `connect-src` includes Supabase and configured provider origins.
- Add CSRF-safe cookie/session handling through Supabase SSR.
- Apply per-user and per-IP rate limits to auth, AI, TTS, imports, and mutations.
- Redact tokens, passwords, raw provider responses, and sensitive merchant data from logs.
- Run dependency audit and secret scan before release.

### G2. Reliability

- Add request IDs across UI, API, database audit, AI, and adapter calls.
- Add structured server logs and error monitoring.
- Add health/readiness endpoint that checks only non-sensitive dependencies.
- Add timeout and retry policy per external provider.
- Add outbox replay and dead-letter handling.
- Add database backup verification and migration rollback notes.

### G3. Deployment

- Keep separate development, preview, and production Supabase projects or schemas.
- Configure all required environment variables in Vercel environments.
- Run migrations before deploying application code that depends on them.
- Never print environment values in build logs.
- Verify callback URLs, webhook URLs, provider origins, and production domain.
- Use a feature flag for each live adapter until its acceptance tests pass.

## 11. Testing strategy

### Unit tests

- Domain engine calculations and deterministic seed behavior.
- Zod schemas and error mapping.
- Permission matrix and role checks.
- Provider selection and fallback behavior.
- Money, timezone, language, and quantity validation.

### Integration tests

- Auth callback and session refresh.
- Merchant creation and membership creation.
- RLS access for owner, manager, staff, and non-member.
- Proposal approval/rejection transaction plus audit event.
- Stock adjustment plus audit event.
- Bill import idempotency and rejected-row handling.
- OpenRouter, Gateway, ElevenLabs, and Sarvam adapters with mocked HTTP responses.
- TTS content type and failure behavior.

### Browser tests

- Sign up, confirmation message, sign in, Google login callback, and sign out.
- First-run merchant onboarding.
- Dashboard navigation and role-aware controls.
- Proposal evidence, approve/reject, and toast feedback.
- Voice transcript, confirmation, TTS playback, and unsupported-browser fallback.
- Mobile 375px and desktop 1171px layouts.

### Security tests

- Anonymous requests receive `401`.
- Non-members cannot read another merchant’s rows.
- Staff cannot approve or manage integrations.
- Client-supplied merchant IDs cannot bypass membership.
- Service-role credentials never appear in browser output.
- Provider keys never appear in client bundles, logs, or API responses.

## 12. Release sequence

1. Apply and verify schema migrations and RLS policies.
2. Ship request context and merchant onboarding behind a feature flag.
3. Convert read-only dashboard queries to authenticated tenant-scoped access.
4. Convert mutations to transactional RPCs and enforce RBAC.
5. Isolate/remove demo service-role paths from production routes.
6. Add and test real data adapters one at a time.
7. Wire TTS playback and complete AI provider configuration.
8. Add operational controls, monitoring, backups, and rate limits.
9. Run the full test matrix against a clean preview environment.
10. Pilot with one merchant, monitor audit/outbox/error metrics, then enable additional merchants.

## 13. Final acceptance checklist

- [ ] New user can sign up, confirm email, sign in, or use Google login.
- [ ] New user can create exactly one initial merchant workspace and becomes owner.
- [ ] All dashboard reads are scoped to the active merchant.
- [ ] Owner, manager, and staff permissions match the matrix.
- [ ] Every consequential action has an audit record.
- [ ] Approvals are idempotent and cannot be duplicated.
- [ ] Demo data is isolated from live merchant data.
- [ ] OpenRouter and Gateway fallback both validate structured output.
- [ ] ElevenLabs and Sarvam return valid audio or a clear configuration error.
- [ ] Voice actions require confirmation before mutations.
- [ ] Imports are idempotent, retryable, and reconcile totals.
- [ ] No provider key or service-role key reaches the browser.
- [ ] Tests, build, migration checks, browser flows, and security checks pass.
- [ ] README, environment variable documentation, deployment steps, and limitations are current.
