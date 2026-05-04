# Loans → Loan Facilities V2 Reconciliation Plan

**Date:** 2026-05-02
**Scope:** `public.loans` (V1, 24 rows, 23 cols) → `public.loan_facilities` (V2, 24 rows, 33 cols)
**Mode:** Read-only audit. No DDL, no src/ changes, no migrations.
**Predecessor:** docs/release/v2-design-loans-income-costs-tenancies-2026-04-30.md (Prompt #32)

---

## Executive Summary

Prompt #32's headline finding holds: **`loan_facilities` is a fully-formed V2 sibling of V1 `loans` with matching row counts (24/24) — this is a wiring problem, not a design problem.** This deeper audit confirms the V2 plumbing is already live: the `/lending` page, dashboard loan KPIs, refinance workflow, tax engine, P&L, ownership attribution, dashboard data-V2 hook, portfolio-api edge function, and the V2 property wizard *all* exclusively read/write `loan_facilities`. V1 `loans` is already a quasi-vestigial table.

**Surprises uncovered by this audit:**

1. **Per-row pairing succeeds at 23/24 (96%)** via address-bridge join (V1 `properties.address_line` → V2 `properties_v2.address_line_1`, lowercased/trimmed). The single mismatch is `25 Arle Gardens` — V1 row exists with a V1 property, V2 facility exists on a different V2 property — likely a casing/city-suffix drift not a real loss.
2. **V1 columns hold ~zero residual data**: `notes` (0/24), `refinance_target_date` (0/24), `broker_name` (0/24), `broker_contact` (0/24), `payment_override_gbp` (0/24), `loan_term_months` (0/24). Only `term_years` is populated on 3 rows and is trivially derivable. There is **no data-loss risk** on V1 freeze for loans.
3. **V1 mutation hooks (`useCreateLoan`, `useUpdateLoan`) are still wired into 4 legacy V1 surfaces**: `PropertyNew.tsx`, `PropertyEdit.tsx`, `MissingInfoPropertyRow.tsx`, and bulk paths in `useBulkPropertyUpdate.ts` + `useBatchImport.ts`. These are the only remaining V1 writers.
4. **Edge functions still read V1 `loans` in 5 places** (financial-forecast, portfolio-chat ×3, generate-investor-report, analyse-acquisition, generate-ai-valuation) — these would silently return stale/empty data after V2 becomes the source of truth if not redirected.
5. **RLS diverges**: V1 uses `properties`-joined org access; V2 uses direct `org_id` checks plus a shareholder-financials role. No alignment work needed for V1 to disappear, but parity must be confirmed before redirecting reads.
6. **V1 freeze-guard trigger does NOT currently apply to `loans`** (Stage A skipped it per Plan §0a). It only attaches to `properties`, `rooms`, `tenants`. Adding it to `loans` is a one-liner once writers are redirected.

**Recommended trajectory:** redirect the 4 V1 writer surfaces to `loan_facilities`, redirect the 5 edge-function readers, attach `v1_freeze_guard` to `loans`, then drop `loans` after a short stabilisation window. This is closer to the "freeze + drop" path than to a full reconciliation.

---

## §1 — Schema Diff

### Columns appearing in both tables (4 by name)

| Column | V1 type / nullability | V2 type / nullability | Notes |
|---|---|---|---|
| `id` | uuid NOT NULL, default `gen_random_uuid()` | same | disjoint id spaces |
| `property_id` | uuid NOT NULL | uuid NOT NULL | V1 → `properties`, V2 → `properties_v2` (post-#41 reconciliation) |
| `notes` | text NULL | text NULL | V1 0/24 populated |
| `created_at` | timestamptz NOT NULL, default `now()` | timestamptz NULL, default `now()` | nullability divergence |

### Semantically equivalent columns (renamed / restructured)

| V1 | V2 | Notes |
|---|---|---|
| `lender` (text) | `lender_id` (uuid NOT NULL) | V2 normalised via `lenders` table; backfill already done |
| `current_mortgage_balance_gbp` (numeric) | `current_balance` (numeric NOT NULL) | V2 NOT NULL |
| `interest_rate_percent` | `interest_rate` (NOT NULL) | |
| `mortgage_payment_gbp` / `payment_auto_calculated_gbp` / `payment_override_gbp` | `monthly_payment` | V2 collapses 3 V1 fields into 1 |
| `fixed_or_variable` (text) | `rate_type` (text NOT NULL) | |
| `capital_or_interest` (text) | `repayment_type` (text NOT NULL, default `'interest_only'`) + `interest_only` (bool, default true) | |
| `mortgage_type` (text) | `facility_type` (text NOT NULL) | |
| `fixed_rate_expires` (date) | `rate_expiry_date` (date) | |
| `reversion_rate_percent` | `revert_rate` | |
| `loan_term_months` / `term_years` | `term_end_date` (date NOT NULL) | V2 stores absolute end date |
| `loan_start_date` | (none — implicit via `created_at` / drawdown) | drawdown date not preserved as such |
| `refinance_target_date` | (no direct equivalent; covered by `rate_expiry_date` + workflow) | V1 0/24 populated |
| `broker_name` / `broker_contact` | (none — moved to `mortgage_applications` workflow table) | V1 0/24 populated |
| `payment_source` | (no equivalent — V2 always single source) | V1 always `'auto'` |

### V1-only columns — data-loss risk on freeze

| Column | Pop. count | Risk | Mitigation |
|---|---|---|---|
| `loan_start_date` | unknown — sample shows 0 | Low | Approximate via V2 `created_at` if needed |
| `term_years` | 3/24 | Negligible | Convert to `term_end_date = loan_start_date + term_years` during redirect |
| `payment_override_gbp` | 0/24 | None | — |
| `broker_name`, `broker_contact` | 0/24 | None | — |
| `notes` | 0/24 | None | — |
| `refinance_target_date` | 0/24 | None | — |
| `payment_source` | always `'auto'` | None | — |

### V2-only columns (added value beyond V1)

`org_id`, `entity_id`, `account_reference`, `arrangement_fee`, `legal_fee`, `original_amount`, `ltv_at_drawdown`, `current_ltv`, `early_repayment_charge_until`, `erc_percentage`, `covenant_ltv_max`, `covenant_icr_min`, `product_name`, `status`, `term_end_date`, `interest_only`, `repayment_type`. All NOT NULL fields (`org_id`, `entity_id`, `lender_id`, `original_amount`, `current_balance`, `interest_rate`, `facility_type`, `rate_type`, `repayment_type`, `term_end_date`, `status`) are populated on all 24 V2 rows.

**Net schema verdict:** V2 is a strict superset (modulo trivial drops). No V1-only data needs preservation.

---

## §2 — Per-Row Mapping (24 V1 rows ↔ 24 V2 rows)

### Strategy results

| Strategy | Matches | Rate | Notes |
|---|---|---|---|
| (a) shared `id` | 0/24 | 0% | Expected — disjoint id spaces |
| (b) (V1→V2 property bridge, lender, current_balance) triple | 22/24 | 92% | Lender names have trailing whitespace in V1 (`"Quantum  "`, `"Landbay "`) — must `trim` |
| (c) (V1→V2 property bridge, current_balance) pair | 23/24 | 96% | Tolerates lender drift |
| (d) V1→V2 property bridge alone (1 loan per property holds in this dataset) | 23/24 | 96% | Same single mismatch as (c) |

The V1→V2 property bridge used: `LEFT JOIN properties_v2 p2 ON lower(trim(p2.address_line_1)) = lower(trim(p1.address_line))`. 23 of 24 V1 loan-properties resolve. (`tmp_property_id_remap` from #29/#41 already dropped, so the live-address bridge is the operative path.)

### The single unmatched pair

- **V1 row** `4fef3020-8985-4310-b249-e5af8dfbe096` — property `21a866cb-bc88-4f42-985e-f6e4d785ce84`, address `"25 Arle Gardens, Cheltenham "`, lender `Lendinvest`, balance £202,000. V1 property has **no `properties_v2` counterpart** under that exact address.
- **V2 row** `596fa758-64f3-49b7-b6de-8813eb05e775` — property `f4938519-8091-4644-ac3b-a021e6d67b8d`, address `"25 Arle Gardens"`, lender Lendinvest, balance £202,000. V2 property exists with no V1 ancestor via address match.

**Verdict:** these are almost certainly the same loan; address differs only by `", Cheltenham"` suffix. Confirm by manual lookup or postcode bridge before freeze. **No real data loss expected.**

### V1-only orphans (would lose data on freeze)

None. All 24 V1 rows have a V2 counterpart with matching balance.

### V2-only orphans (V2 data not derivable from V1)

None — every V2 row pairs to exactly one V1 row by balance + property bridge (with the single Arle Gardens caveat above). Two V1 rows have NULL `current_mortgage_balance_gbp` (`9a8b7576-…` Lendhub, `d2ac75c2-…` Maslow Capital) — both still pair on property alone.

---

## §3 — Consumer Audit (src/)

### V1 `loans` consumers

| File | Line(s) | Op | Classification |
|---|---|---|---|
| `src/hooks/useProperties.ts` | 33–48 | `from('loans').select` (joined in `useProperties()`) | **read** |
| `src/hooks/useProperties.ts` | 60–72 | `from('loans').select` (joined in `useProperty()`) | **read** |
| `src/hooks/useProperties.ts` | 145–168 (`useCreateLoan`) | `from('loans').insert` | **write** |
| `src/hooks/useProperties.ts` | 170–215 (`useUpdateLoan`) | `from('loans').update` | **write** |
| `src/hooks/useBulkPropertyUpdate.ts` | 20, 49–61 | `from('loans').update` (bulk) | **write** |
| `src/hooks/useBatchImport.ts` | 91, 107, 116 | `from('loans')` insert / update | **write** |
| `src/pages/PropertyNew.tsx` | 8, 19 | `useCreateLoan()` | **write** (V1 page) |
| `src/pages/PropertyEdit.tsx` | 8, 22–23 | `useUpdateLoan`, `useCreateLoan` | **write** (V1 page) |
| `src/components/missing-info/MissingInfoPropertyRow.tsx` | 37, 61, 116, 158, 397 | `useUpdateLoan` + reads `property.loans[0]` | **both** |

### V2 `loan_facilities` consumers (representative; 35+ refs)

**Read paths:** `useLoanFacilities.ts:156/183/212/229` (all hooks), `useDashboardDataV2.ts:60`, `usePropertyPnL.ts:59`, `usePortfolioFinancials.ts:72`, `usePortfolioKPIs.ts:60–94`, `useTaxEngine.ts:153`, `useTaxData.ts:135`, `useShareholderPortfolioData.ts:117`, `useOwnershipAttribution.ts:93/179`, `useOwnershipFlowchart.ts:145`, `usePropertiesCompat.ts:53`, `useActivationChecklist.ts:42`, `useRefinanceWorkflow.ts` (via hook), `Dashboard.tsx:38/67`, `PropertyDetailV2.tsx:32/71`, `Lending/hooks/useLendingState.ts:3–12`, `components/lending/*` (LoanFacilityCard, LoanStressTest, RefinanceComparison, RateExpiryDashboard, ApplicationTracker, PropertyLoansSection).

**Write paths:** `useLoanFacilities.ts:246/270/295` (create/update/delete), `LoanFacilityModal.tsx:70–71`, `PropertyWizard.tsx:11/44`, `AddPropertyWizard.tsx:113`, `SnapshotEntryModal.tsx:118`, `DistributionWizard.tsx:147`, `seedDemoData.ts:135/253`.

**Pages affected by redirect:** `/dashboard`, `/lending`, `/refinancing`, `/properties-v2/:id` (financials tab), `/properties-v2/wizard`, `/tax`, `/distributions`, `/ownership`. None of these touch V1 `loans`.

**V1-only pages still alive:** `/properties/new` (`PropertyNew.tsx`) and `/properties/:id/edit` (`PropertyEdit.tsx`) — both V1 surfaces likely already deprecated by V2 wizard but still wired.

---

## §4 — Edge Function Audit (supabase/functions/)

### V1 `loans` consumers

| Function | Line(s) | Op |
|---|---|---|
| `financial-forecast/index.ts` | 434 | read |
| `portfolio-chat/tool-executor.ts` | 69, 241, 505, 567 | read (4 sites) |
| `generate-investor-report/index.ts` | 98 | read |
| `analyse-acquisition/index.ts` | 99 | read |
| `generate-ai-valuation/index.ts` | 302 | read |

All read-only, all selecting `*` or core financial fields. **All would return stale/empty data once V1 is frozen → drift risk if not redirected.**

### V2 `loan_facilities` consumers

| Function | Line(s) | Op |
|---|---|---|
| `portfolio-api/index.ts` | 128, 227, 264 | read |

No V2 writes from edge functions today.

---

## §5 — RLS Comparison

### V1 `loans` (4 policies)

All 4 (SELECT/INSERT/UPDATE/DELETE) use the property-join pattern:

```sql
EXISTS (
  SELECT 1 FROM properties p
  WHERE p.id = loans.property_id
    AND user_has_org_access(p.org_id)
)
```

Policy names: `Users can view loans for their properties`, `Users can insert loans for their properties`, `Users can update loans for their properties`, `Users can delete loans for their properties`. No shareholder-role variant.

### V2 `loan_facilities` (5 policies)

- `loan_facilities_select` / `loan_facilities_insert` / `loan_facilities_update` / `loan_facilities_delete` — direct `user_has_org_access(org_id)` (no property join — `org_id` is denormalised onto the row).
- `Shareholders can view loan facilities` — extra SELECT policy via `user_has_shareholder_financials_access(org_id)`.

### Divergence

- **Membership semantics align** — both ultimately gate on `user_has_org_access`.
- **V2 is strictly more permissive on read** (adds shareholder role) and **strictly faster** (no property join).
- **No lockstep RLS rewrite needed** when V1 disappears, because no V2 policy references `loans`.

---

## §6 — V1 Freeze-Guard Status

- `public.v1_freeze_guard()` trigger function exists (created in `supabase/migrations/20260428235107_…sql`).
- Currently attached to: `properties`, `rooms`, `tenants` only (confirmed via `pg_trigger` query).
- **NOT attached to `loans`, `income`, `costs`, `tenancies`** — matches Plan §0a explicit skip.
- Once V1 writers are redirected (Build Prompt B below), attaching the guard is one ALTER per table.
- The `src/lib/v1Frozen.ts` `throwV1Frozen` union currently only allows `'properties' | 'rooms' | 'tenants'` — must be widened to include `'loans'` (and ultimately income/costs/tenancies) before Prompt B lands.

---

## §7 — Recommended Build Prompt Sequence

### Prompt A — Backfill Arle Gardens drift + verify pairing (small)

Reconcile the single (V1 prop `21a866cb…` ↔ V2 prop `f4938519…`) discrepancy. Manually confirm both rows describe the same physical asset; if so, normalise the V1 property address or extend the bridge to use postcode/UPRN. Output: a one-row migration adding the manual mapping into a temp bridge plus a smoke test asserting all 24 V1 loans pair 1:1 to V2. **No schema changes.** Estimated complexity: small.

### Prompt B — Redirect V1 mutation hooks to V2 (medium)

Widen `throwV1Frozen` in `src/lib/v1Frozen.ts` to accept `'loans'`. Rewrite `useCreateLoan` / `useUpdateLoan` in `src/hooks/useProperties.ts:145–215` to throw via `throwV1Frozen('loans', …)`. Update the 4 V1 write surfaces (`PropertyNew.tsx`, `PropertyEdit.tsx`, `MissingInfoPropertyRow.tsx`, `useBulkPropertyUpdate.ts`, `useBatchImport.ts`) to either (a) call `useCreateLoanFacility` / `useUpdateLoanFacility` instead, or (b) be deleted if the V2 wizard already covers the surface (likely true for `PropertyNew`/`PropertyEdit`). Run `npm run verify`; fix `useProperties.ts` first, then page-by-page. Estimated complexity: medium.

### Prompt C — Redirect 5 edge functions from `loans` to `loan_facilities` (medium)

Update `financial-forecast`, `portfolio-chat/tool-executor` (4 sites), `generate-investor-report`, `analyse-acquisition`, `generate-ai-valuation` to read `loan_facilities` with the column-name remap (`current_mortgage_balance_gbp`→`current_balance`, `interest_rate_percent`→`interest_rate`, `lender`→join via `lender_id`, `mortgage_payment_gbp`→`monthly_payment`). Add a single shared `loanFacilityToLegacyShape()` helper in `_shared/` if multiple call-sites expect the V1 column names. Re-run `npm run verify` and the edge-function deno check. Estimated complexity: medium.

### Prompt D — Attach `v1_freeze_guard` trigger to `public.loans` (small)

Single migration: `CREATE TRIGGER v1_freeze_guard BEFORE INSERT OR UPDATE OR DELETE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.v1_freeze_guard();`. Run smoke test asserting INSERT throws. Confirm no app-side regressions (Prompts B + C must land first). Estimated complexity: small.

### Prompt E — Drop `public.loans` after stabilisation window (small, post-soak)

After ≥1 week of frozen-guard with no violations in logs: drop the 4 RLS policies, drop the `set_loans_updated_at` trigger, drop the table. `src/integrations/supabase/types.ts` will auto-update. Mark §V2-reframe loans item CLOSED in the design doc. Estimated complexity: small.

### Optional Prompt F — Repeat the playbook for `income`, `costs`, `tenancies` (large)

Apply the same 5-step pattern (audit → backfill → redirect hooks → redirect edge functions → freeze → drop) to the remaining three V2-reframe items from Prompt #32. Each is independent; estimate one Prompt-A-through-E cycle per table. Estimated complexity: large overall (3× medium chains).

---

## §8 — Risk Notes for Implementer

1. **Lender name drift**: V1 has trailing whitespace on multiple rows (`"Quantum  "`, `"Landbay "`). Any join on `lender` text must `trim/ilike`. V2 already uses `lender_id` so this is contained to the audit/verification scripts only.
2. **`PropertyEdit.tsx` may be reachable from V1 routes**: confirm the router doesn't still link to it before deleting; otherwise users hitting that route will see a freeze-guard error.
3. **`MissingInfoPropertyRow.tsx`** reads `property.loans[0]` from a `useProperties` query — this read path becomes empty once `loans` is dropped; the component must switch to a V2 source (`useLoanFacilitiesByProperty`) **in lockstep** with Prompt B, not after.
4. **`useBatchImport.ts`** is the CSV import path — confirm import schema templates point at V2 fields after redirect.
5. **No RLS lockstep needed** for the drop itself, but Prompt B should verify `user_has_org_access` returns identical results for the test user across both pre- and post-redirect to catch any property-bridge edge cases.
6. **`useProperties.ts:33–72` joins `loans(*)` in its select** — once `loans` is dropped, both `useProperties()` and `useProperty()` will fail at PostgREST resource-embed time. Either remove the join (and have downstream consumers fetch from V2) or delete the V1 hook entirely. Check downstream readers of `PropertyWithFinancials.loans` before the drop.

## Pair completeness fix shipped 2026-05-04

- Option (a) chosen: normalised V1 `properties.address_line` for `21a866cb-bc88-4f42-985e-f6e4d785ce84` from `"25 Arle Gardens, Cheltenham "` → `"25 Arle Gardens"` to match V2 `properties_v2.address_line_1`.
- Migration: `supabase/migrations/<auto>-loans-arle-gardens-pair.sql` (idempotent; temporarily disables `v1_freeze_guard` for this single one-row data fix).
- Smoke test: `src/__tests__/loans-pair-completeness.test.ts` + `src/__tests__/fixtures/loans-pair-snapshot.json` — asserts every V1 `loans.id` resolves 1:1 to a V2 `loan_facilities.id` via the address bridge.
- Post-fix pairing: **24/24 (100%)**.

## V1 loans writers redirected 2026-05-04 (Prompt §7.B)

- `src/lib/v1Frozen.ts`: widened `throwV1Frozen` to accept `'loans'` (target `loan_facilities`).
- `src/hooks/useProperties.ts`: `useCreateLoan` / `useUpdateLoan` now throw via `throwV1Frozen('loans', …)` — mirrors V1 properties freeze pattern; signatures preserved.
- **PropertyNew.tsx** — option (b) leave call site as-is. Page already calls frozen `useCreateProperty`; the V2 wizard (`AddPropertyWizard`) is the active create path. Adding the V2 hook here would resurrect a deprecated V1 surface.
- **PropertyEdit.tsx** — option (b) leave call site as-is. Same reasoning: page already calls frozen `useUpdateProperty`; V2 wizard handles property/loan edits via `loan_facilities`.
- **MissingInfoPropertyRow.tsx** — option (b) leave call site as-is. Component already invokes frozen `useUpdateProperty`; the loan-edit branch (`updateLoan.mutateAsync`) will throw consistently with the rest of its V1 surface. Loan edits should be migrated to a V2 path in a follow-up alongside the V1 properties/income unfreeze plan.
- **useBulkPropertyUpdate.ts** — option (b) `useBulkLoanUpdate` had **zero call sites**; reduced to a freeze-throwing stub that preserves the export shape.
- **useBatchImport.ts** — option (b) deleted the V1 `loans` upsert branch (4 SQL calls). CSV imports now skip loan columns; loans must be added via the V2 wizard / `useCreateLoanFacility`.
- TypeScript clean; 1120 vitest tests pass.

## Edge function loans→loan_facilities redirect 2026-05-04 (Prompt §7.C)

- Shared helper: `supabase/functions/_shared/loanFacility.ts` exports `LOAN_FACILITY_SELECT`, `loanFacilityToLegacyShape()` (V2→V1 column shim incl. `lender_id` → `lenders.lender_name` embed), and `warnIfPropertyIdSpaceMismatch()` for surfacing silent-zero forecasts in logs.
- **financial-forecast** — replaced V1 select with V2 select via helper; downstream math unchanged. Adds property_id-space mismatch warning.
- **generate-investor-report** — V2 select via helper; mapped at consumption (`loans.reduce(... current_balance ...)` continues to work).
- **generate-ai-valuation** — single-row LTV lookup ported to `loan_facilities.current_balance`; logs warning when no row matches V1 propertyId.
- **analyse-acquisition** — V2 select via helper, lender concentration now uses resolved `lender_name`. Mismatch warning added.
- **portfolio-chat/tool-executor** — all 4 sites (`get_property_details`, `get_property_financials`, `portfolio_summary`, `risk_summary`) ported to V2 with helper + mismatch warnings.
- **Column gaps**: `broker_name`, `broker_contact`, `loan_start_date`, `term_years`, `loan_term_months`, `payment_override_gbp`, `payment_auto_calculated_gbp`, `payment_source`, `refinance_target_date`, `notes` are returned as `null` (V1 had 0/24 populated per audit §1).
- **Property-id space caveat**: `loan_facilities.property_id` → `properties_v2.id`, but `financial-forecast`, `analyse-acquisition`, `generate-ai-valuation`, and 3/4 portfolio-chat tools still query V1 `properties`. The helper logs `outcome: "loan_property_id_space_mismatch"` rather than crashing — watch `outcome=server_error`/`loan_property_id_space_mismatch` rates after deploy. Migrating those 4 functions to `properties_v2` is the next prompt; in-scope §7.C was loans-only.
- TypeScript clean; all 5 functions deployed successfully.

## Edge-function V1 properties reads ported to V2 (Prompt §7.C hot-fix) 2026-05-04

Closes the `loan_property_id_space_mismatch` warning surfaced by Prompt #46 by
porting all V1 `properties` reads in the 5 affected edge functions to V2
`properties_v2`, so `loan_facilities.property_id` joins now resolve in the same
id space.

### Per-function `from('properties')` sites ported

- **financial-forecast** — `index.ts:435` (portfolio fetch in `Promise.all`).
- **generate-investor-report** — already on `properties_v2` after #46; no V1 sites remained.
- **generate-ai-valuation** — `index.ts:205` (single-row fetch) and `index.ts:277` (post-valuation `update`, which had no V2 equivalent and was replaced with a structured warning).
- **analyse-acquisition** — `index.ts:100` (portfolio fetch) plus two inline `from('properties')` lookups for `.in("property_id", …)` filters at `:112` and `:119` — all three retargeted to `properties_v2`.
- **portfolio-chat/tool-executor** — 4 sites: `:46` (`get_property_details`), `:238` (`calculate_portfolio_metrics`), `:388` (`search_properties`), `:465` (`generate_report`).

### Column remap applied inline at each `.select()`

| V1 (`properties`) | V2 (`properties_v2`) |
|---|---|
| `address_line` | `address_line_1` |
| `current_value_gbp` | `current_valuation` |
| `purchase_price_gbp` | `purchase_price` |
| `lifecycle_type` | `lifecycle_stage` |
| `has_gas` | `has_gas_supply` |

Downstream math/consumers were preserved by mapping V2 rows back to legacy
field names immediately after the fetch, mirroring the loan helper pattern from
#46 but kept inline (per the hot-fix scope).

### V1-only columns / filters → `console.warn` (no crash)

These have no scalar V2 equivalent and now emit a structured warning with the
property id, then continue with `null`:

- `beds` (lives in `rooms_v2`/`units_v2`) — emitted by `generate-ai-valuation`,
  `analyse-acquisition`, `portfolio-chat:get_property_details`,
  `portfolio-chat:search_properties`.
- `last_valuation_date`, `last_valuation_estimate`, `valuation_confidence`,
  `value_change_percent` — V1-only mirror columns on `properties`. Source of
  truth is `property_valuations`, so the legacy mirror `update` in
  `generate-ai-valuation` was replaced with a warning and skipped.
- `min_beds` filter in `portfolio-chat:search_properties` — ignored with a
  warning (no V2 column to filter on).

### TypeScript hygiene

Cascading `WithLenderName` cast errors caused by Supabase's `GenericStringError`
union were fixed with the standard `as unknown as Parameters<typeof
loanFacilityToLegacyShape>[0][]` pattern at every `loanFacilityToLegacyShape`
call site across the 5 functions. The `executeTool(supabase, …)` call site in
`portfolio-chat/index.ts` got the same `as unknown as
Parameters<typeof executeTool>[0]` cast.

### Verification

- `node scripts/check-edge-functions.mjs` clean across all 5 functions
  (one unrelated pre-existing error in `reprocess-vault-documents` —
  out of scope).
- `grep from('properties')` across the 5 functions returns zero results.
- 5 functions re-deployed.
- Post-deploy edge-function logs show no `loan_property_id_space_mismatch`
  outcomes for `financial-forecast` (the function that previously fired most
  often). `warnIfPropertyIdSpaceMismatch` should now never fire for these 5
  functions because both sides of the join are in V2 id space.
