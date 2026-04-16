# TenureIQ — Repository Review & Improvement Plan

**Reviewed:** 2026-04-16
**Scope:** Full-repository audit of `hydrogencap/hydrogencap` (TenureIQ) covering frontend, Supabase backend, edge functions, tests, CI/CD, tooling, and documentation.
**Goal:** A prioritised, actionable roadmap of improvements and add-ons. Items are tagged `[IMPROVEMENT]` (existing-system cleanup / hardening) or `[ADD-ON]` (net-new capability).

---

## 1. Review Summary

### Snapshot

| Area | Observation |
| --- | --- |
| Stack | React 18 + Vite 5 + TypeScript (strict: **off**) + Supabase + Shadcn UI + React Query |
| Source | 559 components, 249 hooks, 90 pages, 5 contexts |
| Backend | Supabase Postgres with RLS, 58 edge functions (Deno), 20k+ lines of migrations |
| Tests | 49 Vitest files + 9 Playwright specs — coverage low, mostly smoke |
| CI | GitHub Actions: lint, unit, build, edge-check, Playwright smoke. No CD, no security scans |
| Docs | README + go-live + UAT checklists. No schema, edge-function, or ADR docs |

### Top Structural Issues

1. **Dual schemas still live** — `properties` / `properties_v2`, `tenants` / `tenants_v2`, `compliance` / `compliance_v2`. V1 code paths still imported; no cutover plan committed.
2. **TypeScript strict mode disabled**, ~2.9k `any` usages, `(supabase as any)` casts scattered.
3. **React-hooks lint rules largely disabled** — masks real effect/render-order bugs.
4. **Known stale code** — `useWorkOrders.ts:424` TODO for WO → financial_snapshots sync, `TeamManagement.tsx` stub, duplicate-property handling manual.
5. **Test coverage gap** — payments, RLS, edge functions, and portals essentially untested.
6. **Edge-function fan-out** — 58 Deno functions with no shared contract validation, rate limiting, or dead-letter handling.
7. **Auth complexity** — three parallel auth surfaces (main, shareholder, tenant) with duplicated session/expiry logic.
8. **No CD / no staging validation** — releases rely on Lovable Cloud auto-deploy; rollback path undocumented.

---

## 2. Guiding Principles

- **Finish before we add.** V1→V2 migration and team management stub close before new verticals.
- **Prove with tests, not prose.** Every critical change pairs with a Vitest unit or Playwright flow.
- **Strict where it matters.** Enable strict TS and hook rules per-folder — tax engine, calculations, RLS-touching code first.
- **Boundaries, not layers.** Keep edge functions and the SPA coupled only by typed contracts (Zod + generated types).
- **Observability first.** Every new surface ships with Sentry breadcrumbs, structured logs, and a dashboard metric.

---

## 3. Prioritised Roadmap

Priority legend: **P0** must-fix (debt/risk), **P1** high-value, **P2** strategic, **P3** opportunistic.
Effort: **S** ≤ 1 week, **M** 1–3 weeks, **L** 1–2 months, **XL** quarter+.

### P0 — Foundations (weeks 1–6)

| # | Item | Type | Effort | Dependencies |
| --- | --- | --- | --- | --- |
| P0.1 | V1 → V2 schema cutover (properties, tenants, compliance) | IMPROVEMENT | L | Migration dashboard, backfill edge fn |
| P0.2 | Enable TS `strict` per-folder (lib, hooks/tax-*, hooks/compliance-*, edge _shared) | IMPROVEMENT | M | — |
| P0.3 | Re-enable `react-hooks/*` rules; fix fallout | IMPROVEMENT | M | — |
| P0.4 | Edge-function contract layer (Zod request/response + shared error envelope) | IMPROVEMENT | M | — |
| P0.5 | RLS policy regression suite (pgTAP or Vitest + service-role client) | IMPROVEMENT | M | Staging seed data |
| P0.6 | Delete V1 hooks/components flagged deprecated; codemod imports | IMPROVEMENT | S | P0.1 first phase |
| P0.7 | Close `useWorkOrders.ts:424` — sync WO `actual_cost` → `financial_snapshots.maintenance_costs` | IMPROVEMENT | S | — |

### P1 — Reliability, Performance, UX (weeks 4–14)

| # | Item | Type | Effort | Dependencies |
| --- | --- | --- | --- | --- |
| P1.1 | Virtualise property/tenant/compliance lists (react-virtual) | IMPROVEMENT | S | — |
| P1.2 | Dashboard zone code-split + suspense skeletons | IMPROVEMENT | M | — |
| P1.3 | Server-side pagination/sort/filter via Supabase RPC | IMPROVEMENT | M | — |
| P1.4 | React Query cache audit — keys, staleTime, prefetching | IMPROVEMENT | S | — |
| P1.5 | Unify error envelope + user-facing toast taxonomy | IMPROVEMENT | S | P0.4 |
| P1.6 | Session/expiry flow: single `useSessionGuard` hook shared by 3 auth surfaces | IMPROVEMENT | M | — |
| P1.7 | Accessibility pass (axe-core in CI + keyboard traps in dialogs) | IMPROVEMENT | M | — |
| P1.8 | Visual regression with Playwright + Chromatic-style snapshots for top 20 pages | IMPROVEMENT | M | CI budget |
| P1.9 | Bundle budget + CI gate (fail if main chunk > 300KB gzip) | IMPROVEMENT | S | — |
| P1.10 | Edge-function rate limiting + CRON_SECRET verification audit | IMPROVEMENT | S | P0.4 |
| P1.11 | Secret scanning + SCA (Dependabot, OSV) wired into CI | IMPROVEMENT | S | — |
| P1.12 | Offline-tolerant reads (React Query persist + service worker shell) | IMPROVEMENT | M | P1.4 |

### P2 — Feature Add-Ons (weeks 8+)

| # | Item | Type | Effort | Dependencies |
| --- | --- | --- | --- | --- |
| P2.1 | **Public API tier** — REST + API-key auth, OpenAPI spec generated from Zod | ADD-ON | L | P0.4 |
| P2.2 | **Team management v1** — invite, role assignment, per-property ACL | ADD-ON | M | — |
| P2.3 | **Mobile companion (PWA first, React Native after)** — inspections, photo capture, signature | ADD-ON | L | P1.12 |
| P2.4 | **Real-time collaboration on property records** (Supabase Realtime + presence) | ADD-ON | M | — |
| P2.5 | **Automated rent reconciliation** — Open Banking (TrueLayer / Plaid UK) feed → matcher → ledger | ADD-ON | L | Reconciliation engine refactor |
| P2.6 | **Custom report builder** — drag/drop fields, saved views, scheduled email | ADD-ON | L | P1.4, P2.1 |
| P2.7 | **Regulatory-change copilot** — diff RSS/gov.uk, map to affected properties, draft remediation tasks | ADD-ON | M | Compliance-v2 only |
| P2.8 | **Tenant portal payments** — Stripe Connect or Open Banking PIS for rent | ADD-ON | L | P2.5 |
| P2.9 | **AI acquisition advisor v2** — comparables + stress-test + broker-pack export | ADD-ON | M | Land Registry enrich |
| P2.10 | **Data room / investor deal flow** — raise rounds, cap-table events, signed docs | ADD-ON | L | Share register tables |

### P3 — Nice-to-haves / Strategic Bets

| # | Item | Type | Effort |
| --- | --- | --- | --- |
| P3.1 | Webhook marketplace (outbound events: tenancy_signed, compliance_expired, payment_received) | ADD-ON | M |
| P3.2 | Zapier / Make.com integration | ADD-ON | S |
| P3.3 | Xero + QuickBooks connectors (parallel to FreeAgent) | ADD-ON | M |
| P3.4 | SSO (Google Workspace, Microsoft Entra) for team plan | ADD-ON | M |
| P3.5 | AI meeting notes → compliance task creator | ADD-ON | M |
| P3.6 | Benchmarks — anonymised portfolio KPIs vs peers | ADD-ON | L |
| P3.7 | White-label investor portal theming (currently partial) | ADD-ON | M |

---

## 4. Improvement Detail

### 4.1 V1 → V2 Schema Cutover (P0.1)

**Why:** Dual tables double every feature, double RLS surface, and make aggregate queries ambiguous.

**Plan:**
1. Inventory residual V1 usage: `grep` `from('properties')`, `from('tenants')`, `from('compliance')` — classify as *read*, *write*, *migration*.
2. Build one-shot edge function `migrate-v1-to-v2` with idempotent upserts keyed on org + legacy id.
3. Add `/migration-dashboard` progress panel per table.
4. Flip reads behind `useLegacyReads` feature flag → default off per-org once backfill verified.
5. Drop V1 writes (return 410 Gone from hooks), keep V1 tables in read-only archive for 90 days.
6. Delete V1 tables + code + tests.

**Exit criteria:** 0 imports of V1 hooks, 0 references to V1 tables in `supabase/functions/**`, single source of truth in Reports/Dashboards.

### 4.2 TypeScript Strict Mode Rollout (P0.2)

**Why:** 2,900+ `any` instances erode every other improvement. Strict mode surfaces real bugs — especially around nullable rows from Supabase.

**Plan:**
1. Add `tsconfig.strict.json` extending `tsconfig.app.json` with `strict: true`.
2. Whitelist folders incrementally via `files`/`include`. Start with `src/lib/*.ts` (pure), then `src/hooks/useTax*`, `src/hooks/useCompliance*`, then `supabase/functions/_shared/`.
3. Add CI job `tsc -p tsconfig.strict.json --noEmit`.
4. Ban new `any` in strict folders via `@typescript-eslint/no-explicit-any` override.
5. Generate Zod → TS from the Supabase schema (e.g. `supabase-to-zod`) so RLS-touching reads validate at boundary.

### 4.3 React-Hooks Lint Re-enable (P0.3)

**Why:** `react-hooks/set-state-in-effect` and `no-components-during-render` being off means the next compiler upgrade breaks silently.

**Plan:**
1. Re-enable rules one at a time on a throwaway branch, measure violations.
2. Fix or suppress with `// eslint-disable-next-line` + tracking comment per violation.
3. Commit per rule with issue ID. Target zero suppressions in hooks that touch auth, money, or compliance.

### 4.4 Edge-Function Contract Layer (P0.4)

**Why:** 58 functions with ad-hoc JSON shapes. Frontend break risk is high; versioning impossible.

**Plan:**
```ts
// supabase/functions/_shared/contract.ts
export const defineFn = <I extends ZodType, O extends ZodType>(cfg) => ...
// Produces: input validation, typed output, uniform error envelope, Sentry trace, CRON_SECRET guard, structured log.
```
- Migrate functions in order of blast-radius: billing (`stripe-webhook`, `create-checkout`, `check-subscription`), auth (`send-*-invite`), AI (`portfolio-chat`, `generate-investor-report`).
- Auto-generate `src/integrations/edge/types.ts` from the Zod schemas so the SPA calls functions with inferred types.

### 4.5 RLS Regression Suite (P0.5)

**Why:** RLS is the only thing between a viewer and another org's tenancy ledger. No automated test today.

**Plan:**
- Seed script: org A + org B + users per role.
- pgTAP or Vitest-based runner executing: "user X tries action Y on table Z → expect row count / error". Covers every table that has RLS.
- Run in CI against `supabase db reset` ephemeral DB.

### 4.6 Performance Quick Wins (P1.1–P1.4)

- **Virtualise** `PropertiesV2`, `TenantsV2`, `ComplianceCalendar`, rent-collection tables (react-virtual).
- **Split dashboard zones** into independently suspended islands (already lazy at route level; extend inside).
- **Server paging** — migrate client-side filters on >1k-row tables to Supabase RPC with `count=estimated`.
- **React Query audit** — codify default `staleTime: 60_000`, `gcTime: 5min`; add query-key factory to prevent collisions; prefetch on hover for common drill-downs.

### 4.7 Accessibility (P1.7)

- Run axe-core over Playwright smoke pages; fail CI on serious violations.
- Focus-trap audit for every Radix Dialog (some wizards lose focus on step change).
- Keyboard nav test in `AppSidebar` (50+ items with sub-groups).
- Colour-contrast sweep — dark mode tokens in `tailwind.config.ts` currently ~4.1:1 on muted text.

### 4.8 Auth Consolidation (P1.6)

Three near-identical guards (`ProtectedRoute`, `PortalProtectedRoute`, `TenantPortalProtectedRoute`) duplicate session-expiry and redirect logic.

**Plan:**
- Extract `useSessionGuard({ kind: 'app' | 'portal' | 'tenant' })` hook — single source for JWT refresh, expiry modal, redirect target.
- Collapse three wrappers to one `<Guarded kind="...">`.
- Shared expiry modal uses portal-specific branding via `OrgContext`.

### 4.9 Observability (cross-cutting)

- Sentry: ensure `beforeSend` scrubs email/address/bank fields before shipping.
- Structured logs in edge functions — JSON lines with `org_id`, `fn`, `duration_ms`, `outcome`.
- Synthetic checks on `/auth`, `/dashboard`, `/portal/dashboard`, `/tenant-portal/dashboard` every 5 min.

---

## 5. Add-On Detail

### 5.1 Public API Tier (P2.1)

**Audience:** Pro-tier customers with bespoke BI or accountants.
**Surface:** REST + Webhooks. OAuth2 client-credentials + scoped API keys (`prop:read`, `compliance:write`, etc.).
**Build:** Edge function `api-v1` router using the contract layer. OpenAPI spec auto-generated. Rate limit per key via Postgres counter + 429 envelope.

### 5.2 Team Management v1 (P2.2)

**Gap:** `/team-management` is a 589-byte stub.
**Scope:**
- Invite user → email w/ one-time token → accept → `memberships` row with role.
- Per-property ACL (optional override of org role).
- Audit log entry on every ACL change.
- Billing integration: seats metered via Stripe usage records.

### 5.3 Mobile Companion (P2.3)

**Phase 1 — PWA:** installable, service worker for `/inspections`, `/maintenance-request/:id`, camera + signature capture, offline queue.
**Phase 2 — React Native (Expo):** if PWA telemetry justifies, share domain code via workspace package.

### 5.4 Open Banking Rent Reconciliation (P2.5)

Move reconciliation from manual CSV to live feed:
- TrueLayer or Plaid UK AIS connection per org, stored encrypted in Supabase Vault.
- `reconcile-transactions` edge function: pull → match by reference / amount / tenant → auto-post, flag uncertain.
- Tenant portal switches from Stripe-card-only to PIS (Payment Initiation) for rent — lower fees, instant settlement.

### 5.5 Custom Report Builder (P2.6)

- Saved "views" on `properties_v2`, `tenancies_v2`, `compliance_v2`, `financial_snapshots` — column picker, filters, groupings.
- Schedule: daily / weekly / monthly → PDF/CSV email via existing generator.
- Export to API endpoint for BI tool pulls.

### 5.6 Regulatory Copilot (P2.7)

- Scheduled function polls gov.uk / legislation feeds.
- Classifier (Lovable AI) tags each change to the HMO/EPC/Awaab taxonomy.
- Impacted-property query → generated remediation tasks → review UI before bulk insert.

### 5.7 Investor Deal Flow / Data Room (P2.10)

- Extend share register with round events, term-sheet docs, e-sign.
- Cap-table math: pre/post-money, waterfall.
- Shareholder portal gets a "Rounds" tab with committed/drawn tracking.

---

## 6. Dev Experience & Docs

| # | Item | Effort |
| --- | --- | --- |
| DX.1 | Architecture Decision Records in `docs/adr/` — V1→V2, edge-contract, auth consolidation | S |
| DX.2 | `docs/schema.md` generated from `supabase db dump` + diagrams (dbdocs.io or mermaid-erd) | S |
| DX.3 | Edge-function index doc listing every function, inputs, outputs, cron schedule | S |
| DX.4 | CONTRIBUTING.md + CODEOWNERS | S |
| DX.5 | Storybook for Shadcn-derived primitives + feature components | M |
| DX.6 | Release notes automation (changesets or release-please) | S |
| DX.7 | Pre-commit hook (lefthook) — lint-staged + typecheck-staged | S |

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| RLS regression leaks cross-org data | Low | Catastrophic | P0.5 regression suite + quarterly manual pen test |
| Stripe webhook drift (schema changes) | Medium | High | Contract tests + Stripe CLI replay in CI |
| Lovable Cloud AI outage breaks dashboards | Medium | Medium | Degrade-gracefully — cache last insight, show "stale" badge |
| V1→V2 migration data loss | Low | Catastrophic | Idempotent migrate + 90-day read-only archive + pg_dump before flip |
| Bundle bloat as AI features grow | High | Medium | P1.9 budget + route-level code split |
| Accessibility lawsuit / WCAG complaint | Low | High | P1.7 axe-core gate |

---

## 8. Suggested 90-Day Execution Plan

**Weeks 1–2 (Foundations open)**
- P0.2 strict TS scaffold, P0.3 hooks lint audit, P0.7 WO cost sync, DX.1 ADR for V1→V2.

**Weeks 3–6**
- P0.1 migration phase 1 (properties), P0.4 contract layer on billing/auth functions, P0.5 RLS suite seeded, P1.9 bundle gate, P1.11 SCA.

**Weeks 7–10**
- P0.1 phase 2 (tenants, compliance), P1.1–P1.4 performance, P1.6 auth consolidation, P1.7 a11y CI gate.

**Weeks 11–13**
- P2.2 team management v1 ship, P2.7 regulatory copilot alpha, P3.1 webhook marketplace MVP.

---

## 9. Open Questions for Product

1. Is FreeAgent the long-term accounting backbone, or should Xero/QuickBooks land in the first add-on wave?
2. Which Pro-tier customers are asking for the public API? Shape OpenAPI accordingly.
3. Is the mobile investment a PWA-first or "React Native from day one" call?
4. Commercial model for Open Banking PIS — absorb costs or pass-through to landlord?
5. Timeline for sunset of V1 endpoints — can we commit to a 90-day read-only window?

---

*Prepared on branch `claude/repo-review-plan-3KHV2`. No code changes in this commit — review and adjust priorities with product/engineering before scheduling.*
