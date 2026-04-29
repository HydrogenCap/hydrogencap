# Edge Function Structured Logging Audit — 2026-04-29

## Goal
Ops/oncall can `grep` Supabase logs by `org_id` / `user_id` / `fn` / `request_id` and see latency + outcome per invocation.

## Approach (per user decision: "Wrapper + opportunistic org_id")
- Extended `supabase/functions/_shared/logger.ts` with `withInvocationLog(fnName, handler)` and an `InvocationLogger` API (`event`, `withOrg`, `setUser`, plus the existing `info/warn/error/withUser`).
- Each `Deno.serve(...)` / `serve(...)` callback was wrapped via a one-line transformation. No handler return statements were touched. Zero behavioural change.
- `user_id` is best-effort decoded from the JWT `sub` claim (no signature verification — pure log enrichment; real auth still goes through `supabase.auth.getUser()`).
- `org_id` starts `null` on every invocation. Handlers may attach it via `_invocationLog.withOrg(orgId)` once resolved — this is the "opportunistic" follow-up surface (deferred, listed Uncertain below).
- CORS preflight (`OPTIONS`) requests are intentionally not logged to keep noise low.

## Emitted JSON shape
```
{ level, ts, fn, rid, uid, org_id, msg: 'invocation.start', method, url }
{ level, ts, fn, rid, uid, org_id, msg: 'invocation.end', latency_ms, outcome, status }   // 2xx/4xx/5xx
{ level, ts, fn, rid, uid, org_id, msg: 'invocation.end', latency_ms, outcome: 'error', error }  // thrown
```
- `outcome` ∈ `ok` (<400), `client_error` (4xx), `server_error` (5xx), `error` (thrown).
- `level` is `info` for ok, `warn` for 4xx/5xx, `error` for thrown — keeps existing console.error Sentry signal intact.
- `rid` is `crypto.randomUUID()`.

## Per-function inventory
55 non-`_shared/` functions. All 55 wrapped. Audit columns:
- **Auth?** — function calls `supabase.auth.getUser` (real auth check, separate from log enrichment).
- **org_id source** — where org_id could be opportunistically attached in a future pass.
- **Pre-existing `console.*`** — left untouched (still emit; structured log is additive).

| Function | Auth | org_id source (opportunistic) | console.* lines | Notes |
|---|---|---|---|---|
| admin-stats | ✓ | platform-admin scope | 1 | service-role; no per-org |
| ai-compliance-checker | ✓ | from request body / RLS | 0 | already used createLogger |
| ai-gap-fill | (handler) | request body | 0 | thin shim → handler.ts |
| analyse-acquisition | ✓ | profile → org membership | 0 | already used createLogger |
| apply-passport-suggestions | ✓ | property→org via FK | 3 | |
| auto-compliance-pipeline | cron-secret | iterates all orgs | 3 | cron — no single org_id |
| auto-generate-rent-schedule | cron | iterates orgs | 2 | cron |
| auto-send-rent-reminders | cron | iterates orgs | 4 | cron |
| bulk-epc-enrich-v2 | ✓ | derived from properties_v2 | 6 | |
| bulk-epc-enrich | ✓ | derived from properties | 5 | |
| bulk-price-paid-enrich | ✓ | derived from properties | 9 | |
| categorise-documents | ✓ | document→property→org | 8 | |
| check-regulatory-changes | ✓ | platform-admin | 0 | |
| check-subscription | ✓ | per-user only | 1 | no org_id concept |
| companies-house-lookup | (handler) | n/a (lookup proxy) | 0 | thin shim |
| companies-house | ✓ | n/a | 1 | external lookup |
| company-secrets | ✓ | company→org | 5 | |
| create-checkout | (handler) | per-user (Stripe) | 0 | thin shim |
| create-compliance-jobs | ✓ | from req body | 8 | |
| customer-portal | (handler) | per-user (Stripe) | 0 | thin shim |
| delete-account | ✓ | profile → org | 1 | |
| dispatch-webhook | ✓ | webhook owner org | 1 | |
| estimate-construction-year | ✓ | n/a (lookup) | 6 | external |
| fetch-land-registry-comparables | ✓ | n/a (lookup) | 7 | external |
| financial-forecast | ✓ | from req body | 2 | already used createLogger |
| freeagent-fetch-categories | ✓ | from req body | 0 | |
| freeagent-oauth-callback | state-param | resolved via state | 4 | OAuth callback |
| freeagent-sync-payments | ✓ | from req body | 1 | |
| generate-ai-valuation | ✓ | property→org | 5 | |
| generate-investor-report | ✓ | from req body | 0 | already used createLogger |
| generate-passport-suggestions | ✓ | property→org | 4 | |
| geocode-address | ✓ | n/a (lookup) | 7 | external |
| get-maps-key | ✓ | per-user only | 0 | key proxy |
| portfolio-api | ✓ | from JWT app_metadata | 1 | |
| portfolio-chat | ✓ | from req body | 0 | already used createLogger |
| portfolio-insights | ✓ | from JWT | 3 | |
| portfolio-location-insights | ✓ | from JWT | 3 | |
| predict-arrears | ✓ | from req body | 0 | already used createLogger |
| process-document-v2 | ✓ | document→property→org | 0 | already used createLogger |
| process-document | ✓ | document→property→org | 6 | already used createLogger |
| process-tenancy-agreement | ✓ | tenancy→property→org | 5 | |
| property-autofill | ✓ | n/a (enrichment lookup) | 11 | external lookups only |
| property-lookup | ✓ | n/a (lookup) | 16 | external |
| send-compliance-reminders | cron | iterates orgs | 7 | cron |
| send-investor-portal-access | ✓ | investor→org | 2 | |
| send-job-reminders | cron | iterates orgs | 11 | cron |
| send-job-request | ✓ | job→property→org | 5 | |
| send-rent-reminder | ✓ | tenancy→property→org | 1 | |
| send-shareholder-invite | ✓ | from req body | 2 | |
| send-team-invite | ✓ | from req body | 2 | |
| send-tenancy-expiry-reminders | cron | iterates orgs | 2 | cron |
| send-tenant-certificates | ✓ | tenancy→property→org | 4 | |
| send-weekly-compliance-email | cron | iterates orgs | 6 | cron |
| stripe-webhook | signature-verified | resolved via Stripe customer email | 1 | webhook |
| summarize-valuation-document | ✓ | document→property→org | 7 | |

## Uncertain — flagged for follow-up
For these functions `org_id` is **not cleanly derivable** in the wrapper without significant handler changes. They will log `org_id: null` until a future opportunistic pass calls `_invocationLog.withOrg(...)` inside the handler:

| Function | Reason |
|---|---|
| admin-stats | Platform-admin scope, no single org context. |
| auto-compliance-pipeline | Cron — iterates all orgs in one run. Per-org would require per-iteration `event()` calls. |
| auto-generate-rent-schedule | Cron, multi-org. |
| auto-send-rent-reminders | Cron, multi-org. |
| send-compliance-reminders | Cron, multi-org. |
| send-job-reminders | Cron, multi-org. |
| send-tenancy-expiry-reminders | Cron, multi-org. |
| send-weekly-compliance-email | Cron, multi-org. |
| check-regulatory-changes | Platform-level scrape. |
| check-subscription | Per-user, not per-org. |
| get-maps-key | Per-user key proxy, no org context. |
| create-checkout / customer-portal | Per-user Stripe sessions. |
| companies-house / companies-house-lookup / estimate-construction-year / fetch-land-registry-comparables / geocode-address / property-autofill / property-lookup | External-lookup proxies; no org_id is stored or required for the call. |
| stripe-webhook | Webhook authenticated by signature; org resolved later via Stripe customer email lookup inside handler. |
| freeagent-oauth-callback | OAuth callback authenticated via state param; org resolved mid-handler. |

All other ~30 functions can opportunistically call `_invocationLog.withOrg(orgId)` after their existing org-membership lookup; that follow-up is **not** in this pass per the "do not change business logic" guardrail.

## Deferred (intentional)
- `_invocationLog.withOrg(orgId)` is **not** wired into any handler in this pass. The wrapper exposes the API; instrumenting the ~30 candidate functions is a separate small follow-up that touches handler bodies (one line each, after the existing org-membership lookup).
- Existing `console.log` / `console.error` / per-function ad-hoc loggers (`logStep`, `[STRIPE-WEBHOOK]`, etc.) were left untouched — they're additive context and remain a Sentry signal per spec.

## Verification
- `tsc --noEmit`: clean.
- `vitest run`: **1090 / 1090 passed**.
- Deno logger tests: **13 / 13 passed** (7 pre-existing + 6 new for `withInvocationLog`).
- `node scripts/check-edge-functions.mjs`: All 55 wrapped functions parse and resolve `withInvocationLog`. One pre-existing TS error in `summarize-valuation-document/index.ts:123` (`adminSupabase = supabase` type drift) is **not introduced by this change** — confirmed by reverting the wrap and re-checking.

## Files changed
- `supabase/functions/_shared/logger.ts` — extended (additive).
- `supabase/functions/_shared/logger.test.ts` — 6 new Deno tests.
- `supabase/functions/<each>/index.ts` — 55 files, one-line `serve(...)` wrap + one new import line.

**Total: 57 files changed, 55 functions instrumented.**
