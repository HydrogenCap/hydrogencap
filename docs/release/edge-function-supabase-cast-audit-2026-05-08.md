# Edge Function `SupabaseClient<any>` Cast Audit — 2026-05-08

Read-only audit. No code, schema, or test changes were made. Scope: every
`*.ts` file under `supabase/functions/` (69 entry files + shared helpers).

## Step 1 — Raw findings

Searched for: `SupabaseClient<any>`, `as unknown as` patterns involving the
Supabase client, bare `: any` annotations on parameters that receive a
Supabase client, and helper invocations that pass `adminClient` / `supabase`
across function boundaries.

### 1.a — `as unknown as <ClientType>` casts at the createClient boundary

| # | File | Line | Snippet | Receiving signature |
|---|------|------|---------|---------------------|
| 1 | `supabase/functions/portfolio-chat/index.ts` | 306 | `executeTool(supabase as unknown as Parameters<typeof executeTool>[0], orgId, toolName, toolArgs)` | `executeTool(supabase: SupabaseClient<Database>, …)` from `tool-executor.ts` |
| 2 | `supabase/functions/reprocess-vault-documents/index.ts` | 118 | `generateSignedUrl(adminClient as unknown as Parameters<typeof generateSignedUrl>[0], doc.file_url)` | local `generateSignedUrl(client: SupabaseClient<Database>, …)` (line 17) |
| 3 | `supabase/functions/summarize-valuation-document/index.ts` | 123 | `adminSupabase = supabase as unknown as ReturnType<typeof createClient>` | assignment to module-scoped `adminSupabase` used by helpers below |

These are the **3 fixes already shipped this session** (#46b, #59c, and the
reprocess-vault-documents predecessor). Pattern is identical: a client
created via `esm.sh/@supabase/supabase-js@<v>` without a `<Database>`
generic is being narrowed to a more strongly-typed signature.

### 1.b — Bare `supabase: any` parameter annotations (untyped client crossing a function boundary)

These do **not** currently fail typecheck because `any` is permissive — they
are the "haven't broken yet" cohort. If any caller is later upgraded to a
typed client, the same `as unknown as` cast will be needed (or the helper
must be properly typed first).

| File | Lines | Helpers |
|------|-------|---------|
| `supabase/functions/portfolio-api/index.ts` | 125, 158, 176, 190, 225, 260 | `getPortfolioSummary`, `getProperties`, `getCompanies`, `getComplianceStatus`, `getLoans`, `getActionItems` |
| `supabase/functions/admin-stats/index.ts` | 124, 234, 330, 352 | `getDashboardStats` and 3 sibling aggregators |
| `supabase/functions/portfolio-chat/index.ts` | 420, 446, 470, 500 | 4 internal helpers (separate from the typed `executeTool` boundary at 306) |
| `supabase/functions/process-document/index.ts` | 152 | doc-processing helper |
| `supabase/functions/freeagent-sync-payments/index.ts` | 16 | `getValidToken(connection: any, supabase: any)` |
| `supabase/functions/freeagent-fetch-categories/index.ts` | 36 | `getValidToken(connection: any, supabase: any)` |

Total: **17 untyped boundary parameters across 6 files**.

### 1.c — `as unknown as` casts that are **row-shape** translations (not client-shape) — out of scope

For completeness, these are a different pattern (PostgREST row → legacy V1
shape via the `_shared/loanFacility.ts` / `propertyCostBudget.ts` /
`propertyIncomeBudget.ts` helpers) and are **not** the cast issue we are
auditing. Listed so future audits don't conflate them:

- `portfolio-chat/tool-executor.ts:110, 141, 305, 306, 308, 588, 590, 592, 653, 655`
- `analyse-acquisition/index.ts:143, 149`
- `financial-forecast/index.ts:460, 466, 468, 474, 476`
- `generate-investor-report/index.ts:128`
- `send-rent-reminder/index.ts:106` (tenancy join shape)
- `stripe-webhook/handler.test.ts:225` (test mock)

### 1.d — Existing shared helper conventions (`supabase/functions/_shared/`)

Files: `checkSubscription.ts`, `cors.ts`, `loanFacility.ts`, `logger.ts`,
`propertyCostBudget.ts`, `propertyIncomeBudget.ts`, `rateLimit.ts`,
`validate.ts` (+ tests).

Relevant precedent: `_shared/rateLimit.ts:1-4` already declares a
**structural** client type to dodge this exact problem:

```ts
// Structural supabase-client type — the real `SupabaseClient<Database>`
// from supabase-js satisfies this, and a test stub with `.from()` does too.
// deno-lint-ignore no-explicit-any
export type RateLimitSupabaseLike = { from: (table: string) => any };
```

The row-shape helpers (`loanFacility.ts` etc.) are pure functions over plain
data — they do not touch the client. There is **no existing
`getAdminClient()` / typed-client helper** in `_shared/`.

## Step 2 — Group by failure mode

| Cohort | Count | Files |
|--------|-------|-------|
| (i) Already fixed this session via `as unknown as` cast | 3 | portfolio-chat/index.ts:306, reprocess-vault-documents:118, summarize-valuation-document:123 |
| (ii) Same root cause, **not yet** in verify path because the receiving boundary is `: any` (no narrowing pressure) | 17 sites / 6 files | portfolio-api, admin-stats, portfolio-chat (4 helpers), process-document, freeagent-sync-payments, freeagent-fetch-categories |
| (iii) Different but related — structural workaround already in place | 1 | `_shared/rateLimit.ts` (`RateLimitSupabaseLike`) |

Cohort (ii) will start failing the moment anyone tightens those `: any`
parameters (e.g. when somebody finally types a return value, or upgrades
supabase-js and the inferred shape diverges).

## Step 3 — Helper-conventions assessment

The team's `_shared/` directory currently contains:

- **Pure data mappers** (`loanFacility.ts`, `propertyCostBudget.ts`,
  `propertyIncomeBudget.ts`) — PostgREST row → legacy shape.
- **Cross-cutting infra** (`cors.ts`, `logger.ts`, `validate.ts`,
  `checkSubscription.ts`, `rateLimit.ts`).

A `getAdminClient()` / `_shared/admin-client.ts` would slot naturally next
to `rateLimit.ts` and follows the same "lazy-import the supabase-js esm
build, return a typed client" pattern that `rateLimit.ts` already does
inline. **The convention is consistent with introducing it.**

The blocker historically has been that the `Database` generic lives in
`src/integrations/supabase/types.ts` (frontend) and edge functions are
forbidden from importing `src/`. The 3 sites we already patched sidestep
this by casting to `ReturnType<typeof createClient>` rather than
`SupabaseClient<Database>` — i.e. they accept the loss of row-shape
inference. A shared helper would codify that same trade-off in one place.

## Step 4 — Recommendation

**Option C — Hybrid.**

Rationale:

- **Option A (per-site)** keeps blast radius minimal but guarantees we will
  be back here a 4th, 5th, 6th time as cohort (ii) gets tightened. We've
  already paid this cost three times in one session — the pattern is
  proven recurring.
- **Option B (refactor all 20 sites)** is tempting but touches 6 large,
  unrelated functions (portfolio-api, admin-stats, portfolio-chat,
  process-document, two freeagent functions). Each refactor risks
  behavioural regressions for zero functional gain — the existing `: any`
  signatures *work*. High effort, low marginal value.
- **Option C (helper for new code, leave existing as-is)** captures the
  reusable abstraction without forcing a sweeping refactor. New edge
  functions and any future fix to cohort (ii) call `getAdminClient()`
  from `_shared/admin-client.ts` and skip the cast entirely. The 3 already-
  patched sites can be migrated opportunistically next time they're
  touched, but there is no urgency.

## Step 5 — Per-file change list (Option C, recommended)

**New file** — `supabase/functions/_shared/admin-client.ts`:

- Exports `getAdminClient()` returning a lazily-created service-role client
  using the same `esm.sh/@supabase/supabase-js@2.49.1` pin as `rateLimit.ts`.
- Exports a `AdminSupabaseClient` type alias = `ReturnType<typeof createClient>`
  so consumer signatures can read `client: AdminSupabaseClient` instead of
  `: any` or `: SupabaseClient<any>`.
- Exports a structural fallback type `AdminSupabaseLike` mirroring the
  `RateLimitSupabaseLike` precedent for test injection.

**Migrated sites (opportunistic, on next touch)** — 3 files, mechanical:

| File | Line | Before | After |
|------|------|--------|-------|
| portfolio-chat/index.ts | 306 | `supabase as unknown as Parameters<typeof executeTool>[0]` | drop cast; type `executeTool`'s first param as `AdminSupabaseClient` |
| reprocess-vault-documents/index.ts | 118 | `adminClient as unknown as Parameters<typeof generateSignedUrl>[0]` | drop cast; type `generateSignedUrl(client: AdminSupabaseClient, …)` |
| summarize-valuation-document/index.ts | 123 | `adminSupabase = supabase as unknown as ReturnType<typeof createClient>` | replace with `adminSupabase = getAdminClient()` (or just use `supabase` typed as `AdminSupabaseClient`) |

**No changes** to cohort (ii) until the next time those files are touched
for unrelated reasons — at which point swap `: any` → `: AdminSupabaseClient`
in the same diff.

**No changes** to `_shared/rateLimit.ts` — the `RateLimitSupabaseLike`
structural type is already optimal for its testability needs. Helper
deliberately doesn't unify with it; rate-limit accepts a stub for tests,
admin-client doesn't need to.

**(For reference — Option B per-file would additionally rewrite all 17
parameter annotations in cohort (ii); not recommended.)**

---

## Summary

**Total occurrences found: 20** — 3 already patched via `as unknown as`
casts (cohort i), 17 untyped `: any` boundary parameters across 6 files
that will reproduce the same failure once tightened (cohort ii), plus 1
structural workaround in `_shared/rateLimit.ts` (cohort iii). **Recommended
option: C (hybrid)** — add a single `_shared/admin-client.ts` helper
exposing `getAdminClient()` and an `AdminSupabaseClient` type alias, then
migrate the 3 already-cast sites opportunistically on next touch and adopt
the helper in any new function. **Estimated complexity: small** — one new
~30-line helper file, no immediate refactor required, zero runtime change,
no schema or migration impact.

---

## Option B migration shipped 2026-05-08

David picked **Option B** (full fix). All 20 occurrences migrated to a shared
typed admin-client helper.

### New helper — `supabase/functions/_shared/admin-client.ts`

```ts
export type AdminSupabaseClient = SupabaseClient<any, "public", any>;
export type AdminSupabaseLike = { from: (t: string) => any; auth?: any; storage?: any };
export function getAdminClient(): AdminSupabaseClient;
```

Bare-default `SupabaseClient` generics chosen over `ReturnType<typeof createClient>`
because the latter resolves to `<unknown, never, GenericSchema>` and is **not**
assignable from anon-key user clients (`<any, "public", any>`). The permissive
default accepts both shapes without per-call casts.

### Per-file changes

| File | Before | After |
|------|--------|-------|
| `_shared/admin-client.ts` | (new) | Helper + 2 type aliases |
| `summarize-valuation-document/index.ts` | `as unknown as ReturnType<typeof createClient>` cast (L123) + `let adminSupabase: ReturnType<…>` (L62) | `getAdminClient()` + `AdminSupabaseClient` |
| `reprocess-vault-documents/index.ts` | `as unknown as Parameters<…>[0]` cast (L118) + `ReturnType<…>` param | `generateSignedUrl(adminClient, …)` direct, `AdminSupabaseClient` param, `getAdminClient()` init |
| `portfolio-chat/index.ts` | `as unknown as Parameters<typeof executeTool>[0]` (L306) + 4× `// deno-lint-ignore` + `supabase: any` helpers (L420/446/470/500) | Cast removed; 4 helpers retyped to `AdminSupabaseClient` |
| `portfolio-chat/tool-executor.ts` | 7× `supabase: SupabaseClient` (bare) | 7× `supabase: AdminSupabaseClient` |
| `portfolio-api/index.ts` | 6× `supabase: any` (L125/158/176/190/225/260) | 6× `supabase: AdminSupabaseClient` |
| `admin-stats/index.ts` | 4× `supabase: any` (L124/234/330/352) + inline `createClient(URL, SERVICE_KEY)` (L49) | 4× `AdminSupabaseClient` + `getAdminClient()` |
| `process-document/index.ts` | `supabase: any` (L152) + 2× inline service-role `createClient` (L416/649) | `AdminSupabaseClient` + `getAdminClient()` (×2) |
| `freeagent-sync-payments/index.ts` | `supabase: any` (L16) + inline service-role `createClient` (L64) + inferred-`unknown` regression on `payment.id` | `AdminSupabaseClient` + `getAdminClient()` + `as any[]` widening on the legacy payments loop |
| `freeagent-fetch-categories/index.ts` | `supabase: any` (L36) + inline service-role `createClient` (L106) | `AdminSupabaseClient` + `getAdminClient()` |
| `_shared/rateLimit.ts` | `RateLimitSupabaseLike` structural type | **Unchanged** — deliberately retains stub-friendly shape for `rateLimit.test.ts` injection (per audit Step 5 guidance) |

### Verification

- `npm run check:edge` — **70 entry files clean** (was failing typecheck on
  `freeagent-sync-payments` after first pass; resolved by the `as any[]`
  widening on the V1 payments loop where the inferred row type collapsed to
  `unknown` once the supabase client was tightened).
- `npm run lint` — **0 warnings** under `--max-warnings 0`.

### Total

**20 sites migrated** (3 cohort-i casts removed · 17 cohort-ii `: any`
parameters retyped · 1 cohort-iii intentionally preserved). One new ~30-line
helper file. Zero runtime change. No schema or migration impact.
