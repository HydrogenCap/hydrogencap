# V2 Replacement Design — `loans`, `income`, `costs`, `tenancies`

**Generated:** 2026-04-30
**Mode:** read-only design (no DDL, no `src/` edits, no migrations written)
**Scope:** the 4 V1 tables that Stage A deliberately left behind because rent reminders, property P&L, financial forecast, AI tooling, and the tenant portal still depend on them.

---

## 0. Headline finding — three of four V2 replacements already exist

A pre-flight scan of `information_schema.tables` revealed that **the team has already shipped V2 siblings for 3 of the 4 tables, and they are already populated with row counts that match (or are close to) V1**:

| V1 table | V1 rows | Existing V2 sibling | V2 rows | Status |
|---|---:|---|---:|---|
| `loans` | 24 | **`loan_facilities`** | 24 | Functional shell + matching data — needs reconciliation, not greenfield design |
| `tenancies` | 13 | **`tenancy_agreements`** | 13 | Functional shell + matching data — needs reconciliation |
| `costs` | 3 | **`tax_expenses`** | 0 | Different shape (per-line tax category vs annual buckets) — partial replacement only |
| `income` | 21 | **none** | — | True greenfield — V2 has no annual-rent table, only live rent flowing from `tenancy_agreements` |

This radically changes the framing of the prompt. Instead of "design 4 V2 tables", the work is:

1. **Reconcile** `loan_facilities` ↔ `loans` (write paths still hit V1 — V2 reads are stale or duplicated).
2. **Reconcile** `tenancy_agreements` ↔ `tenancies` (V1 still owns rent schedules, payment reminders, portal access).
3. **Decide** whether `costs` is replaced by `tax_expenses` (line-item) or needs a thin annual-bucket overlay (`property_cost_budgets_v2`).
4. **Greenfield** decision for `income`: keep an annual override table (`property_income_budgets_v2`) or delete the concept and derive everything from agreements.

---

## 1. `loans` — V1 schema, consumers, and gap to `loan_facilities`

### V1 columns (23, scoped by `property_id`)
`id`, `property_id` (→ `properties.id` CASCADE), `lender` (text), `interest_rate_percent`, `fixed_or_variable` (CHECK fixed|variable), `mortgage_type`, `capital_or_interest` (CHECK capital|interest), `fixed_rate_expires`, `reversion_rate_percent`, `refinance_target_date`, `broker_name`, `broker_contact`, `current_mortgage_balance_gbp`, `mortgage_payment_gbp`, `notes`, `loan_start_date`, `loan_term_months`, `payment_auto_calculated_gbp`, `payment_override_gbp`, `payment_source` (CHECK auto|manual), `term_years`, `created_at`, `updated_at`.

No `org_id`, no `lender_id`, no `entity_id`, no soft-delete column, no covenants, no fees breakdown.

### V2 sibling `loan_facilities` (33 columns) already provides
`id`, `org_id`, `property_id`, `lender_id`, `entity_id`, `facility_type`, `original_amount`, `current_balance`, `rate_type`, `interest_rate`, `rate_expiry_date`, `revert_rate`, `monthly_payment`, `term_start_date`, `term_end_date`, `early_repayment_charge_until`, `erc_percentage`, `ltv_at_drawdown`, `current_ltv`, `interest_only`, `repayment_type`, `arrangement_fee`, `valuation_fee`, `legal_fee`, `total_setup_costs`, `covenant_ltv_max`, `covenant_icr_min`, `product_name`, `account_reference`, `status`, `notes`.

### Field mapping V1 → V2
| V1 | V2 (`loan_facilities`) | Notes |
|---|---|---|
| `lender` (text) | `lender_id` (uuid → `lenders` table) | needs lender directory backfill |
| `interest_rate_percent` | `interest_rate` | direct |
| `fixed_or_variable` | `rate_type` | direct |
| `capital_or_interest` | `repayment_type` + `interest_only` | needs split |
| `fixed_rate_expires` | `rate_expiry_date` | direct |
| `reversion_rate_percent` | `revert_rate` | direct |
| `refinance_target_date` | — | **missing in V2** — add as `refinance_target_date` |
| `broker_name`, `broker_contact` | — | **missing in V2** — add `broker_id` (party model) or `broker_name`/`broker_contact` |
| `current_mortgage_balance_gbp` | `current_balance` | direct |
| `mortgage_payment_gbp` | `monthly_payment` | direct |
| `loan_start_date` | `term_start_date` | direct |
| `loan_term_months` / `term_years` | derive `term_end_date` from `term_start_date` + months | requires migration logic |
| `payment_auto_calculated_gbp`, `payment_override_gbp`, `payment_source` | — | **missing in V2** — auto-vs-manual payment override semantics absent |
| `mortgage_type` | `facility_type` | needs vocabulary alignment (BTL / commercial / bridge) |

**Net gap:** `loan_facilities` is missing `refinance_target_date`, `broker_*`, and the manual-override payment trio. Conversely it adds 12 new columns V1 doesn't have (LTV, covenants, fees, ERC).

### Consumers
| Path | R/W | Notes |
|---|---|---|
| `src/hooks/useProperties.ts:151,183` | both | `insertLoan`, `updateLoan` mutations |
| `src/hooks/useBatchImport.ts:107,116` | both | CSV import upsert path |
| `src/hooks/useBulkPropertyUpdate.ts:51` | write | bulk rate update |
| `supabase/functions/portfolio-chat/tools.ts` | read | AI portfolio query |
| `supabase/functions/portfolio-chat/tool-executor.ts` | read | AI executor |
| `supabase/functions/portfolio-api/index.ts` | read | external API surface |
| `supabase/functions/analyse-acquisition/index.ts` | read | acquisition analysis |
| `supabase/functions/generate-ai-valuation/index.ts` | read | AI valuation |
| `supabase/functions/generate-investor-report/index.ts` | read | investor PDF |
| `supabase/functions/financial-forecast/index.ts` | read | forecast engine |

10 consumers; **3 write paths in `src/`**, **7 read-only edge functions**.

### Recommendation
Treat `loan_facilities` as the V2 target and **promote it to canonical**. Add the 4 missing columns (`refinance_target_date`, `broker_name`, `broker_contact`, `payment_override_gbp` + `payment_source`) in one ALTER. Backfill any of the 24 V1 rows whose data is not already present in `loan_facilities` (likely already in sync — verify row-by-row). Then re-point the 3 write paths to `loan_facilities` and the 7 edge functions to `loan_facilities`. Final step is a freeze-trigger on `loans` matching the existing V1 freeze pattern.

---

## 2. `income` — V1 schema, consumers, and the only true greenfield

### V1 columns (6)
`id`, `property_id` (→ `properties.id` CASCADE), `year` (int, NOT NULL), `annual_rent_gbp` (numeric NOT NULL default 0), `created_at`, `updated_at`. UNIQUE `(property_id, year)`.

### Consumers
| Path | R/W | Notes |
|---|---|---|
| `src/hooks/useProperties.ts:227` | write | `upsertIncome` |
| `src/hooks/useBatchImport.ts:135` | write | CSV import upsert |
| `supabase/functions/analyse-acquisition/index.ts` | read | |
| `supabase/functions/generate-investor-report/index.ts` | read | |
| `supabase/functions/financial-forecast/index.ts` | read | |
| `supabase/functions/portfolio-chat/tool-executor.ts` | read | |

6 consumers, 2 writes, 4 read-only.

### Why no V2 sibling exists
Per `mem://features/annual-rent-calculation-logic`, V2's `properties_v2.annual_rent_gbp` (manual override) and live tenancy `rent_amount_pcm * 12` already cover the live-rent case. The only thing `income` adds is **historical year-by-year overrides** for forecasting/scenario modelling. That's a real concept the live tenancy graph cannot replicate (you need yesterday's rent, not today's).

### Recommendation — design a V2 replacement: `property_income_budgets_v2`
```text
property_income_budgets_v2 (
  id              uuid PK default gen_random_uuid(),
  org_id          uuid NOT NULL FK organizations(id),
  property_id     uuid NOT NULL FK properties_v2(id) ON DELETE CASCADE,
  tax_year        text NOT NULL,           -- e.g. '2025/26' to match tax_expenses
  annual_rent_gbp numeric NOT NULL default 0,
  rent_source     text NOT NULL CHECK in ('manual','derived_from_tenancy','derived_from_market'),
  notes           text,
  created_at      timestamptz NOT NULL default now(),
  updated_at      timestamptz NOT NULL default now(),
  deleted_at      timestamptz,
  UNIQUE (property_id, tax_year)
)
```
Choose `tax_year` text (`2025/26`) over `year` int to match `tax_expenses` and the rest of the V2 tax surface. Add `rent_source` to flag whether a row is a user override or a snapshot of derived rent (so future re-derivations don't overwrite a deliberate override).

### Migration risk
- 21 rows to migrate, but `year` int → `tax_year` text needs a deterministic conversion (`year=2025` → `tax_year='2025/26'`?). **Confirm with David** which UK tax year semantics are correct.
- 4 edge functions read `income`; all need to swap to `property_income_budgets_v2`.

---

## 3. `costs` — V1 schema, partial overlap with `tax_expenses`

### V1 columns (20)
`id`, `property_id` (CASCADE), `year`, plus 6 manual buckets (`management_gbp_manual`, `bills_gbp_manual`, `insurance_gbp_manual`, `repairs_gbp_manual`, `compliance_gbp_manual`, `other_gbp_manual`), 6 rule-driven calculation columns (`management_rule_*`, `repairs_rule_*`, `insurance_rule_*`), and audit columns. UNIQUE `(property_id, year)`.

### V2 sibling `tax_expenses` (9 columns)
`id`, `org_id`, `property_id`, `tax_year`, `category`, `description`, `amount`, audit columns. **Line-item shape**, not annual-bucket shape. Currently 0 rows.

### Why this is *not* a clean replacement
`costs` carries two distinct concepts:
1. **Annual budget overrides** per cost category (manual GBP).
2. **Rule-driven autocalculations** (e.g. management = 5% of rent, insurance = 0.3% of value).

`tax_expenses` is for **actual line-item expenses for tax filing** (one row per expense receipt). The two should coexist, not merge.

### Consumers
| Path | R/W | Notes |
|---|---|---|
| `src/hooks/useProperties.ts:258` | write | `upsertCosts` |
| `supabase/functions/financial-forecast/index.ts` | read | forecast |
| `supabase/functions/portfolio-chat/tool-executor.ts` | read | AI |

Only **3 consumers, 1 write path**. This is the smallest blast radius of the four.

### Recommendation — design a V2 replacement: `property_cost_budgets_v2`
```text
property_cost_budgets_v2 (
  id                                  uuid PK,
  org_id                              uuid NOT NULL,
  property_id                         uuid NOT NULL FK properties_v2(id) CASCADE,
  tax_year                            text NOT NULL,
  -- Manual overrides
  management_gbp_manual               numeric default 0,
  bills_gbp_manual                    numeric default 0,
  insurance_gbp_manual                numeric default 0,
  repairs_gbp_manual                  numeric default 0,
  compliance_gbp_manual               numeric default 0,
  other_gbp_manual                    numeric default 0,
  -- Rule engine
  management_rule_enabled             boolean default true,
  management_rule_percent_of_rent     numeric default 5.0,
  management_gbp_calculated           numeric,
  repairs_rule_enabled                boolean default true,
  repairs_rule_percent_of_rent        numeric default 5.0,
  repairs_gbp_calculated              numeric,
  insurance_rule_enabled              boolean default true,
  insurance_rule_percent_of_value     numeric default 0.3,
  insurance_gbp_calculated            numeric,
  audit cols + deleted_at,
  UNIQUE (property_id, tax_year)
)
```
Direct lift of V1 schema with `org_id` added and `year` → `tax_year` text. Keep alongside `tax_expenses` (budgets vs actuals).

---

## 4. `tenancies` — V1 schema, big consumer surface, V2 sibling already 1:1

### V1 columns (22)
`id`, `org_id` (already present!), `tenant_id` → `tenants.id`, `room_id` → `rooms.id`, `property_id` → `properties.id`, `start_date`, `end_date`, `rent_amount_pcm`, `rent_due_day` (CHECK 1–31), `deposit_amount`, `deposit_scheme`, `deposit_reference`, `deposit_protected_date`, `tenancy_agreement_url`, `status` (enum), `notice_date`, `notice_period_weeks`, `notes`, `payment_method` (enum), `payment_reference`, audit cols.

### V2 sibling `tenancy_agreements` (27 columns)
Adds: `tenancy_type`, `initial_end_date`, `actual_end_date`, `rent_frequency`, `prescribed_info_served_date`, `how_to_rent_served_date`, `is_periodic`, `notice_served_date`, `notice_type`, `status`. Drops: `payment_method`, `payment_reference`, `tenancy_agreement_url`, `rent_due_day`, `notice_period_weeks`.

### Field mapping V1 → V2
| V1 | V2 | Notes |
|---|---|---|
| `start_date` | `start_date` | direct |
| `end_date` | `initial_end_date` + `actual_end_date` | needs split |
| `rent_amount_pcm` | `rent_amount_pcm` | direct |
| `rent_due_day` | — | **missing in V2** — needed for `auto-generate-rent-schedule` |
| `deposit_*` (4 cols) | `deposit_*` (4 cols) | direct |
| `tenancy_agreement_url` | — | **missing in V2** — needed for portal certificate viewer |
| `notice_date` | `notice_served_date` | direct |
| `notice_period_weeks` | — | **missing in V2** — needed for S21 pre-flight |
| `payment_method`, `payment_reference` | — | **missing in V2** — needed for rent reminders |
| `status` (enum) | `status` (text) | enum vs text — type alignment |

**Net gap:** V2 is missing 5 fields V1 actively uses: `rent_due_day`, `tenancy_agreement_url`, `notice_period_weeks`, `payment_method`, `payment_reference`.

### Consumers (7 in `src/`, 5 in edge — biggest surface)
| Path | R/W | Notes |
|---|---|---|
| `src/hooks/useTenancies.ts:119,147` | both | insert + update |
| `src/hooks/usePropertyPnL.ts` | read | P&L |
| `src/hooks/useRoomPnL.ts` | read | room P&L |
| `src/hooks/useDocumentManagement.ts` | read | document linkage |
| `src/hooks/useBatchRenameDocuments.ts` | read | doc batch |
| `src/pages/tenant-portal/TenantDashboard.tsx` | read | portal home |
| `src/pages/tenant-portal/TenantCertificates.tsx` | read | portal certs |
| `src/pages/tenant-portal/MaintenanceRequest.tsx` | read | portal raise |
| `supabase/functions/send-rent-reminder/index.ts` | read | cron rent reminder |
| `supabase/functions/send-tenant-certificates/index.ts` | read | cron cert email |
| `supabase/functions/send-tenancy-expiry-reminders/index.ts` | read | cron expiry |
| `supabase/functions/auto-generate-rent-schedule/index.ts` | both | cron (writes `rent_schedule`) |
| `supabase/functions/portfolio-chat/tool-executor.ts` | read | AI |

13 consumers, 2 writes (one in hook, one in cron), 11 reads. **Touches the entire tenant portal and 3 cron jobs.**

### Inbound FK tax (7 child tables — must be re-pointed in lockstep)
`documents.tenancy_id`, `payment_reminders.tenancy_id`, `rent_payments.tenancy_id`, `rent_schedule.tenancy_id`, `tenancy_compliance_items.tenancy_id`, `tenant_portal_access.tenancy_id`, `tenant_portal_invites.tenancy_id` — all `ON DELETE CASCADE`.

This is the heaviest re-point of the four. Two of these (`tenant_portal_*`) ship with `user_has_tenancy_portal_access(id)` policies that look up by V1 `tenancies.id`, so the SECURITY DEFINER function itself needs rewriting.

### RLS impact
`tenancies` carries 2 policies; `tenancy_agreements` will need equivalents. Critically, the `user_has_tenancy_portal_access(uuid)` SECURITY DEFINER function (used by 7 inbound child tables) currently joins through V1 `tenancies` — must be updated in the same migration window or the entire tenant portal goes dark mid-flight.

---

## 5. Cross-table FK touch points (Step 4)

After the V2 replacements ship, these existing V2 tables gain new or rebound FKs:

| Existing V2 table | Column | Target | Notes |
|---|---|---|---|
| `property_legal_ownership` (already V1) | `loan_id` (does not exist today) | `loan_facilities.id` | optional new FK to record which legal ownership covers which loan |
| `tax_expenses` | `cost_budget_id` (new) | `property_cost_budgets_v2.id` | optional — link an actual expense to a budget line |
| `documents`, `payment_reminders`, `rent_payments`, `rent_schedule`, `tenancy_compliance_items`, `tenant_portal_access`, `tenant_portal_invites` | `tenancy_id` | `tenancy_agreements.id` | mandatory re-point, lockstep with policy rewrite |
| `rent_payments` (when we ship reconciliation V2 properly) | `loan_id` | `loan_facilities.id` | optional — for mortgage payment reconciliation |
| `compliance_documents_v2` | `tenancy_id` | `tenancy_agreements.id` | optional new FK if compliance docs scope to a tenancy |

The `tenant_portal_access.tenancy_id` re-point is the highest-risk operation in this whole programme.

---

## 6. Migration risks per table

| Table | Risk | Mitigation |
|---|---|---|
| **loans → loan_facilities** | 24 rows already in V2 — possible drift between V1 and V2 if writes have been split. Schema gap on broker/refinance/payment-override. | Pre-flight diff `loans` vs `loan_facilities` row by row; ALTER `loan_facilities` to add 4 missing columns; backfill from V1; freeze V1. |
| **income → property_income_budgets_v2** | `year` int → `tax_year` text mapping ambiguous (calendar vs UK tax year). 4 edge-function reads. | Confirm semantics with David before migration; ship in two prompts (DDL + backfill, then consumer cutover). |
| **costs → property_cost_budgets_v2** | Smallest blast radius (3 rows, 1 write, 2 reads). Risk of conflating with `tax_expenses`. | Keep `tax_expenses` untouched; create `property_cost_budgets_v2` as direct V1 schema lift. |
| **tenancies → tenancy_agreements** | 7 inbound FKs, 13 consumers, 3 cron jobs, full tenant portal, RLS function `user_has_tenancy_portal_access` joins through V1. Schema gap on 5 V1-used fields. | ALTER `tenancy_agreements` to add the 5 missing columns *first*; pre-flight diff; rewrite RLS function in the same transaction as the FK re-points; cutover crons last. |

---

## 7. Recommended sequencing

The ordering is constrained by (a) what each table's child entities depend on, (b) whether a V2 sibling exists, and (c) whether re-pointing a child table needs the V2 sibling to be canonical first.

1. **`costs` → `property_cost_budgets_v2`** *(small)* — no V2 sibling collision, smallest consumer surface, isolated from other tables. Ship first as a warm-up that uses the proven Class-B template (#27 → #31). One Build prompt.
2. **`income` → `property_income_budgets_v2`** *(small/medium)* — also greenfield, no FK touch points outward, but read by the financial forecast and AI portfolio chat. Ship second so the forecast and AI tooling get a clean V2 read source before we start re-pointing tenancies. One Build prompt.
3. **`loans` → `loan_facilities` (promotion)** *(medium)* — the 24-row in-flight reconciliation needs care, and 7 read-only edge functions need cutover. But no inbound FK re-points and no portal touch. Ship third. **One Build prompt** if the V1↔V2 row diff is clean; **two prompts** (schema/backfill, then consumer cutover) if drift is found.
4. **`tenancies` → `tenancy_agreements` (promotion)** *(large)* — last because it has the 7 inbound FK re-points, the SECURITY DEFINER function rewrite, the entire tenant portal, and 3 cron jobs. Wait until after #3 because some loan-related views the portal surfaces will benefit from `loan_facilities` being canonical. **Three Build prompts**:
   - 4a: ALTER `tenancy_agreements` to add the 5 missing columns; pre-flight diff with `tenancies`; backfill any drift.
   - 4b: Re-point the 7 inbound FKs + rewrite `user_has_tenancy_portal_access` + rewrite RLS policies (single transaction). Smoke-test the tenant portal in preview before merge.
   - 4c: Cutover the 3 cron jobs (`send-rent-reminder`, `send-tenancy-expiry-reminders`, `auto-generate-rent-schedule`) and the 5 portal pages + `useTenancies` hook. Freeze V1 `tenancies` last.

---

## 8. Summary

Shipping order with complexity:

1. **`costs` → `property_cost_budgets_v2`** — small (3 rows, 1 write, 2 reads, no inbound FKs). One Build prompt.
2. **`income` → `property_income_budgets_v2`** — small/medium (21 rows, 2 writes, 4 reads, no inbound FKs, but `year` int → `tax_year` text needs David's confirmation). One Build prompt.
3. **`loans` → promote `loan_facilities` to canonical** — medium (24 rows already in V2 — likely drift, plus 4 schema gaps to fill, 3 writes, 7 read-only edge consumers, no inbound FKs). One Build prompt if V1↔V2 diff is clean, two if not.
4. **`tenancies` → promote `tenancy_agreements` to canonical** — large (13 rows in V2, 5 schema gaps, 7 inbound CASCADE FKs, full tenant portal, 3 cron jobs, RLS SECURITY DEFINER function rewrite). Three Build prompts (schema/diff, FK + RLS re-point, consumer cutover).

## V1 income migrated and dropped 2026-05-06

Bundled single-prompt execution of the costs A–E pattern against V1 `income`
(small dataset: 21 rows, 0 inbound FKs per #32 audit).

**Migration** (`<auto>-income-v2-create-and-backfill.sql`):
- Created `public.property_income_budgets_v2` with columns: `id`, `org_id`
  (NO FK to legal_entities — lesson from #49d-fix), `property_id` FK →
  `properties_v2(id) ON DELETE CASCADE`, `tax_year` text, `annual_rent_gbp`
  numeric NOT NULL DEFAULT 0, audit cols, `UNIQUE (property_id, tax_year)`.
- `updated_at` trigger; RLS enabled with 4 policies via `user_has_org_access(org_id)`.
- Backfilled 21/21 V1 rows with `year=YYYY → tax_year='YYYY/(YY+1)'` (UK
  starting-year rule, locked #50a). Post-flight `RAISE EXCEPTION` parity guard.
- Installed `v1_freeze_guard` on `public.income` (defensive, idempotent).
- **Dropped `public.income`** in same migration (per #32: 0 inbound FKs).

**Code changes**:
- `src/lib/v1Frozen.ts` — added `'income' → 'property_income_budgets_v2'`.
- `src/hooks/usePropertyIncomeBudgets.ts` — new V2 write hook
  `useUpsertPropertyIncomeBudget` (re-exports `yearToTaxYear` from #49b's
  helper for single-source-of-truth).
- `src/hooks/useProperties.ts` — `useUpsertIncome` now throws via `throwV1Frozen`;
  `useProperties`/`useProperty` embeds switched to
  `income:property_income_budgets_v2(*)` with new `mapV2IncomeToLegacy` shim.
- `src/lib/propertyIncomeBudgetCompat.ts` + `supabase/functions/_shared/propertyIncomeBudget.ts`
  — read helpers (`PROPERTY_INCOME_BUDGET_SELECT`, `propertyIncomeBudgetToLegacyShape`,
  `taxYearToYearShim`).

**Consumer ports** (4 read sites + 4 write sites):
- Reads: `analyse-acquisition`, `financial-forecast`, `portfolio-chat/tool-executor.ts`
  (4 sites: `get_property_details`, `get_property_financials`,
  `financial_overview`, `rent_roll`, `portfolio_snapshot`).
- Writes: `PropertyNew.tsx`, `PropertyEdit.tsx`,
  `MissingInfoPropertyRow.tsx`, `useBatchImport.ts` — all moved to
  `useUpsertPropertyIncomeBudget` (or direct V2 upsert in batch import).

**Verification**:
- `psql` confirms 21 rows in `property_income_budgets_v2`, V1 `public.income`
  no longer exists in `information_schema.tables`.
- `src/__tests__/income-pair-completeness.test.ts` (4 assertions) green —
  snapshot captured pre-drop, asserts V2-only invariants.
- Zero remaining `from('income')` references in `src/` or `supabase/functions/`.

**Plan §0a 'income' — CLOSED**. Third of 4 V2-reframe items reconciled
(loans + costs prior; tenancies remaining).

## tenancy_agreements schema parity shipped 2026-05-06

First of the 4-prompt tenancies sequence (#51–#54). Brings V2
`tenancy_agreements` to schema parity with V1 `tenancies` so #52's FK + RLS
rewrites have a stable target.

**Migration** (`<auto>-tenancy-agreements-schema-parity.sql`):
- Added 5 columns (idempotent `IF NOT EXISTS`):
  - `rent_due_day integer NOT NULL DEFAULT 1`
  - `tenancy_agreement_url text`
  - `notice_period_weeks integer DEFAULT 4`
  - `payment_method text` (V1 enum widened to plain text in V2 to avoid
    cross-table enum coupling)
  - `payment_reference text`
- Backfilled via property+start_date bridge (V1 `tenant_id` space ≠ V2
  `tenant_id` space, so we bridge V1.property → V1.address → V2.address →
  V2.property + start_date). 13/13 V1 rows pair uniquely with V2 rows.
- Drift assertion: `RAISE EXCEPTION` if any V1-non-null value failed to land
  on the matched V2 row. **Passed.**

**Backfill outcome** (V2 rows = 13):
- `rent_due_day`: 13/13
- `tenancy_agreement_url`: 13/13
- `notice_period_weeks`: 13/13
- `payment_method`: 12/13 (1 V1 row had NULL — expected, no drift)
- `payment_reference`: 0/13 (V1 had no values populated — expected, no drift)

No FK changes, no RLS changes, no `src/` changes (per #51 scope). Tenant
portal pages render unchanged. Constraint baked in from #49d-fix: no FK on
`org_id → legal_entities`.

## Tenancies FK + RLS + SECURITY DEFINER rewrite shipped 2026-05-06

### FKs flipped (7 inbound, all CASCADE preserved, tenancies → tenancy_agreements)
| Table | Rows backfilled |
|-------|-----------------|
| documents | 14 |
| payment_reminders | 111 |
| rent_payments | 163 |
| rent_schedule | 688 |
| tenancy_compliance_items | 117 |
| tenant_portal_access | 0 |
| tenant_portal_invites | 0 |

Bridge: V1 tenancy → V1 properties.address_line+postcode → properties_v2 → tenancy_agreements (property_id+start_date). 13/13 unique pairs (matches §51).

### RLS policies rewritten (3)
- `rent_payments."Tenants view own payments"` — now `user_has_tenancy_portal_access(tenancy_id)`.
- `rent_schedule."Tenants view own rent schedule"` — same helper.
- `maintenance_requests."Tenants can create maintenance requests"` — joins `tenancy_agreements` instead of V1 `tenancies`.

`pg_policies` scan for residual V1 `tenancies` references in qual/with_check: **0**.

### SECURITY DEFINER fn diff: `user_has_tenancy_portal_access(uuid)`
Removed the `tenancies + tenants.portal_user_id` branch (V2 has no portal column on `tenants_v2`; portal access is exclusively via `tenant_portal_access`). New body joins `tenant_portal_access → tenancy_agreements`. SECURITY DEFINER + `search_path=public` preserved.

### Verification
- Bridge-completeness assertion passed inside the migration (`v_unmapped=0`).
- Per-table post-flight drift assertion passed for all 7 FKs (`v_drift=0`).
- `npm run test -- postgrest-embed-safety` → green (2/2).

## Tenancies consumer cutover shipped 2026-05-06

Re-pointed every src/ and edge-function consumer of V1 `tenancies` to V2 `tenancy_agreements`. No schema, FK, or RLS changes (those landed in #51/#52). V1 mutation hooks now throw via `throwV1Frozen('tenancies', …)` ahead of the table drop in #54.

### Hooks ported
- `src/hooks/useTenancies.ts` — reads now go through `tenancy_agreements`; output mapped back to the legacy `TenancyWithDetails` shape (`end_date` ← coalesce(`actual_end_date`, `initial_end_date`); status `notice_period` ↔ `notice`; `properties_v2.address_line_1` aliased to `address_line`). All five mutation hooks (`useCreateTenancy`, `useUpdateTenancy`, `useActivateTenancy`, `useEndTenancy`, `useGiveNotice`) now `throwV1Frozen('tenancies', …)`. Verified: zero in-repo callers of the V1 mutation hooks.
- `src/hooks/useBatchRenameDocuments.ts` — tenancy resolver re-pointed.
- `src/hooks/useDocumentManagement.ts` — tenancy→property fallback re-pointed (`properties_v2.address_line_1`).
- `src/hooks/useRoomPnL.ts` — V1 `tenancies` rent_payments fallback removed; agreements are the sole source.
- `src/hooks/usePropertyPnL.ts` — V1 `tenancies` rent_payments fallback removed.

### Pages ported
- `src/pages/tenant-portal/TenantDashboard.tsx` — V2 select with aliased property address; tenant `company_name` falls back through `as any` since `tenants_v2` does not carry the column.
- `src/pages/tenant-portal/TenantCertificates.tsx`
- `src/pages/tenant-portal/MaintenanceRequest.tsx`
- (`PropertyStatusBar.tsx` and `TenancyPipelineWidget.tsx` consume `useTenancies` and inherit the cutover unchanged — hook signature preserved.)

### Edge functions ported
- `supabase/functions/auto-generate-rent-schedule/index.ts` — `tenancy_agreements`, `end_date` coalesced.
- `supabase/functions/send-rent-reminder/index.ts` — `tenancy_agreements` + `tenants_v2` + `properties_v2`, address aliased.
- `supabase/functions/send-tenancy-expiry-reminders/index.ts` — `tenancy_agreements`, `notice` → `notice_period`, expiry filter expressed against coalesce(`actual_end_date`, `initial_end_date`) via `or(...)`.
- `supabase/functions/send-tenant-certificates/index.ts` — tenancy lookup re-pointed.
- `supabase/functions/portfolio-chat/tool-executor.ts` — `tenancy_agreements` + `tenants_v2`, end_date coalesced.

### Freeze widening
- `src/lib/v1Frozen.ts` — `'tenancies'` added to the `throwV1Frozen` union; mapped to `tenancy_agreements`.

## Tenancies freeze trigger shipped 2026-05-06

- Installed `v1_freeze_guard` BEFORE INSERT/UPDATE/DELETE on `public.tenancies` (idempotent `DO $$` gated on `pg_trigger NOT EXISTS`). All 6 V1 tables now frozen at the DB layer: `properties`, `rooms`, `tenants`, `loans`, `costs`, `tenancies`.
- Added `src/__tests__/tenancies-frozen.test.ts` mirroring `loans-frozen.test.ts` (#47) and `costs-frozen.test.ts` (#49e) — asserts every V1 mutation hook surface throws via `throwV1Frozen('tenancies', …)`.
- DROP of `public.tenancies` parked as Prompt #54b for a 7-day soak window (≥ 2026-05-13) per the loans #47/#48 precedent. Soak-period monitoring: any DB-side `v1_freeze_guard` raise on `tenancies` indicates a missed consumer and blocks the drop.

## v1_freeze_guard message refined 2026-05-06

Refined `public.v1_freeze_guard()` so the RAISE EXCEPTION names the correct V2 sibling per frozen table (previously hardcoded `<table>_v2`, which was wrong for loans/costs/tenancies). Mappings now baked into a CASE statement:

- `properties` → `properties_v2`
- `rooms` → `rooms_v2`
- `tenants` → `tenants_v2`
- `loans` → `loan_facilities`
- `costs` → `property_cost_budgets_v2`
- `tenancies` → `tenancy_agreements`
- ELSE fallback: `<table>_v2` (for any future-frozen V1 table)

SECURITY DEFINER, pinned `search_path = public, pg_temp`, and LANGUAGE plpgsql preserved. Existing `loans-frozen.test.ts`, `costs-frozen.test.ts`, `tenancies-frozen.test.ts` assert the JS-side `throwV1Frozen` message (already correct) — no test updates required.

---

## #54b — DEFERRED on 2026-05-08 (pre-flight surfaced missed dependencies)

**Decision:** Park the drop of `public.tenancies` until tenant-portal storage RLS is repointed to V2.

**Pre-flight assertions ran:** `v1_freeze_guard` trigger active ✅, 0 FK refs ✅, 0 view refs ✅, 13 stale rows (already migrated to `tenancy_agreements` per #52).

**Bare `DROP TABLE public.tenancies` (no CASCADE) failed with two unaudited dependencies:**

1. **`public.generate_tenancy_compliance_items(tenancies)`** — SECURITY DEFINER plpgsql function whose argument is the V1 row type. Originally fired from a row-level trigger on `public.tenancies` to seed `tenancy_compliance_items`. Unreachable now that #54a froze writes, but still a hard schema dependency on the row type. No V2 caller in repo.
2. **Storage RLS policy "Tenants can read their property documents"** on `storage.objects` — live tenant-portal read path. USING clause joins `tenant_portal_access → tenancies → properties`. Dropping `public.tenancies` (with or without CASCADE) revokes tenant document downloads via the portal.

**No DB state was changed** — DROP rejected by Postgres 2BP01, table/trigger/function/policy all intact.

**Precursor work required before #54b can ship:**

- Repoint the storage RLS policy onto V2: rewrite USING clause to `tenant_portal_access → tenancy_agreements → properties_v2` (`p.org_id` lookup unchanged).
- Confirm `tenant_portal_access.tenancy_id` values resolve in `tenancy_agreements` (#52's 1,093-row migration preserved ids — needs verification before policy swap).
- Tenant-portal smoke test: invited tenant can still list/download property documents post-swap.
- Once the policy is on V2, `#54b` can ship as: `DROP FUNCTION generate_tenancy_compliance_items(tenancies)` → `DROP TRIGGER v1_freeze_guard` → `DROP TABLE public.tenancies` (still no CASCADE, defence in depth).

**Codebase: no edits made this round.** `useTenancies.ts` (V2 reads, frozen mutations), `useProperties.ts` (Tenancy row-type alias), `tenancies-frozen.test.ts`, `useMigration.ts`/`backupConfig.ts` config arrays — all left as-is for the eventual #54b PR.

**Soak rationale (carried forward to whenever #54b ships):** Option 2 — same as #48. Postgres log retention can't observe the soak server-side; rely on client-side `throwV1Frozen('tenancies', …)` (#54a) + `tenancies-frozen.test.ts` + verified absence of any `from('tenancies')` writers in `src/` or `supabase/functions/`.

---

## #54b precursor — Tenant-portal storage RLS cutover (shipped 2026-05-08)

**Cheap path taken.** Pre-Build verification confirmed `tenant_portal_access` is empty in production (0 rows total / 0 active / 0 V1-only / 0 orphaned), so no backfill, no `agreement_id` column, no ID remap — just a single migration that swaps the policy and drops the orphaned function.

**Migration (`supabase/migrations/…_54b-precursor-storage-policy-v2.sql`):**

1. `DROP POLICY "Tenants can read their property documents" ON storage.objects;`
2. Recreate joining `tenant_portal_access → tenancy_agreements → properties_v2`, gated on `tpa.can_view_documents = true`, same org-scoped folder check (`(storage.foldername(objects.name))[1] = p.org_id::text`), `TO authenticated` clause replaces the V1 `auth.role()` predicate.
3. `DROP FUNCTION public.generate_tenancy_compliance_items(public.tenancies);` — confirmed zero callers beyond the row-trigger function (which drops with the V1 table); V2 has its own seeding via `v2-automation-triggers`.

**Post-flight verified:** `to_regprocedure('public.generate_tenancy_compliance_items(public.tenancies)')` → NULL ✅; new policy present on `storage.objects` ✅.

**Semantic change vs V1 policy:** added explicit `can_view_documents = true` gate (V1 ignored this column — latent bug). Org-scoping, read-only semantics, and coarseness unchanged. Empty-table state means observationally a no-op at cutover.

**No code changes** — `useTenantPortalSession.ts` reads `tenant_portal_access` directly without a V1 join, so it was already V2-compatible.

**#54b unblocked.** Remaining pre-flight on `public.tenancies` is now clean: only intra-table triggers + 2 own-table policies + composite row type left, all of which drop with the table. Next PR can ship `DROP TRIGGER v1_freeze_guard` + `DROP TABLE public.tenancies` (still no CASCADE). Tenant-portal page-level V2 cutover (per `.lovable/AF2_Tenant_Portal_V2.md`) remains separately scheduled and is not a #54b blocker.

---

## #54b — SHIPPED 2026-05-08 (deferral closed)

**Precursor cleared:** storage RLS `"Tenants can read their property documents"` rewritten onto V2 (`tenant_portal_access → tenancy_agreements → properties_v2`) and `generate_tenancy_compliance_items(tenancies)` dropped — both #71-surfaced dependencies gone.

**Pre-flight (single round-trip, all assertions passed):**
- `v1_freeze_guard` trigger active on `public.tenancies` ✅
- 0 FK refs ✅
- 0 view refs ✅
- **0 function/policy refs via `pg_depend`** (new check) ✅
- 13 stale rows (informational — already mirrored in `tenancy_agreements` per #52)

**Migration:** `supabase/migrations/20260508204109_…_drop-tenancies.sql` — `DROP TRIGGER IF EXISTS v1_freeze_guard ON public.tenancies` + bare `DROP TABLE public.tenancies` (no CASCADE — pre-flight verified zero deps).

**Post-flight:** `to_regclass('public.tenancies')` → NULL ✅.

**Codebase cleanup (mirrors #48 surface area):**
- `src/hooks/useProperties.ts` — replaced `Database['public']['Tables']['tenancies']['Row']` with a local `Tenancy` type stub (18 fields incl. `rent_amount_pcm`, `status`, `start_date`, `end_date`, etc.) so the deprecated `useProperties`/`useProperty` hook (dead at runtime — no consumer calls it) and downstream `PropertyWithFinancials` consumers (incl. `propertyMetrics.ts`) keep typing.
- `src/__tests__/tenancies-frozen.test.ts` deleted — table no longer exists; freeze-guard pattern still covered by `loans-frozen.test.ts`/`costs-frozen.test.ts`.
- Sweep confirmed zero `from('tenancies')` / `public.tenancies` / `Tables['tenancies']` references in `src/` or `supabase/functions/`. `v1Frozen.ts`'s `'tenancies'` arm + the deprecated `useTenancies.ts` mutation stubs (throw before any DB call) intentionally preserved per #48 precedent. Config arrays in `useMigration.ts` and `backupConfig.ts` left as-is.

**Rule lock — standard drop pre-flight now includes `pg_depend` check.** Going forward, any `DROP TABLE` of a frozen V1 table must assert zero non-trivial entries in `pg_depend` (excluding intra-table triggers, own-table policies, and the composite row type) before issuing the drop. This catches functions taking the row type as an argument and cross-schema RLS policies that FK/view scans miss — both of which #71 found the hard way.

**V2 cutover COMPLETE end-to-end:** loans (#48), costs (Costs Prompt F, 2026-05-07), income (Income migration, 2026-05-06), tenancies (#54b, today) — all four V1 operational tables dropped. The remaining V1 tables (`properties`, `rooms`, `tenants`) host the deprecated `useProperties`/`useRooms`/`useTenants` hooks but are out of scope for this cutover.
