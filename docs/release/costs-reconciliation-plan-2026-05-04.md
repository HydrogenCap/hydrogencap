# Costs reconciliation plan — 2026-05-04

Read-only audit. Mirror of `loans-reconciliation-plan-2026-05-02.md` (which seeded
Prompts #43–#48) applied to V1 `costs`. No code, no schema, no migrations were
touched producing this document.

Sibling docs:
- `docs/release/v2-design-loans-income-costs-tenancies-2026-04-30.md` — §V2-reframe-costs
- `docs/release/loans-reconciliation-plan-2026-05-02.md` — template this mirrors

---

## 1. Context recap (from §V2-reframe-costs)

- `costs` is a **direct-lift greenfield** to a new V2 table —
  `property_cost_budgets_v2`. It is **not** to be folded into `tax_expenses`,
  which models actuals (HMRC-style line-item expenses), not the
  budget/rule-based forecast `costs` represents.
- V1 has **3 rows**.
- Recommended deltas vs V1: add `org_id`, change `year integer` → `tax_year text`
  to align with the V2 convention (matches `tax_expenses.tax_year`).

---

## 2. Schema diff — V1 `costs` vs V2 `property_cost_budgets_v2`

V2 table **does not yet exist** (`information_schema.columns` returned 0 rows).
This is a flag: Prompt A in the proposed sequence below must create the table
+ RLS, not just rewire writes.

### V1 `public.costs` — 20 columns

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `property_id` | uuid | NO | — |
| `year` | integer | NO | — |
| `management_gbp_manual` | numeric | YES | 0 |
| `bills_gbp_manual` | numeric | YES | 0 |
| `insurance_gbp_manual` | numeric | YES | 0 |
| `repairs_gbp_manual` | numeric | YES | 0 |
| `compliance_gbp_manual` | numeric | YES | 0 |
| `other_gbp_manual` | numeric | YES | 0 |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |
| `management_rule_enabled` | boolean | YES | true |
| `management_rule_percent_of_rent` | numeric | YES | 5.0 |
| `management_gbp_calculated` | numeric | YES | — |
| `repairs_rule_enabled` | boolean | YES | true |
| `repairs_rule_percent_of_rent` | numeric | YES | 5.0 |
| `repairs_gbp_calculated` | numeric | YES | — |
| `insurance_rule_enabled` | boolean | YES | true |
| `insurance_rule_percent_of_value` | numeric | YES | 0.3 |
| `insurance_gbp_calculated` | numeric | YES | — |

Notable: V1 has **no `org_id`** (org is reached via `properties.org_id`); the
6 manual `*_gbp_manual` plus 3 rule-engine triplets (enabled / percent / calculated)
are the entire payload.

### V2 `public.property_cost_budgets_v2` — to be created

Proposed (mirrors loans/tenants V2 conventions):

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | NO | `gen_random_uuid()` |
| `org_id` | uuid | NO | FK → `legal_entities.id` (NOT `properties_v2.org_id` denorm) |
| `property_id` | uuid | NO | FK → `properties_v2.id` ON DELETE CASCADE |
| `tax_year` | text | NO | UK convention `'2025/26'`, see §8 |
| `management_gbp_manual` | numeric | YES | default 0 |
| `bills_gbp_manual` | numeric | YES | default 0 |
| `insurance_gbp_manual` | numeric | YES | default 0 |
| `repairs_gbp_manual` | numeric | YES | default 0 |
| `compliance_gbp_manual` | numeric | YES | default 0 |
| `other_gbp_manual` | numeric | YES | default 0 |
| `management_rule_enabled` | boolean | YES | default true |
| `management_rule_percent_of_rent` | numeric | YES | default 5.0 |
| `management_gbp_calculated` | numeric | YES | — |
| `repairs_rule_enabled` | boolean | YES | default true |
| `repairs_rule_percent_of_rent` | numeric | YES | default 5.0 |
| `repairs_gbp_calculated` | numeric | YES | — |
| `insurance_rule_enabled` | boolean | YES | default true |
| `insurance_rule_percent_of_value` | numeric | YES | default 0.3 |
| `insurance_gbp_calculated` | numeric | YES | — |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |
| `deleted_at` | timestamptz | YES | soft-delete (V2 audit standard) |

Constraints: `UNIQUE (property_id, tax_year)` so one budget row per
property per UK tax year (mirrors V1's effective `(property_id, year)` upsert key
in `useUpsertCosts`).

RLS: standard org-member SELECT/INSERT/UPDATE/DELETE pattern via
`user_has_org_access(org_id)`; mirror `loan_facilities` policy text verbatim
to avoid drift.

Trigger: `updated_at` via shared `update_updated_at_column()`; V2 audit-log
trigger per the 13-table standard.

---

## 3. Row inventory — V1 `costs`

`SELECT count(*) FROM public.costs;` → **3 rows**, all in a **single org**:

| V1 cost id | property_id | year | org_id | property |
|---|---|---|---|---|
| `54f487e2-…` | `c008c1c3-…` | 2026 | `e74ae9f0-…` | Knowl House, 52 Stert Street |
| `b600e2c9-…` | `bca9e809-…` | 2026 | `e74ae9f0-…` | 5 William Kimber Crescent |
| `3b57723c-…` | `ea2e1952-…` | 2026 | `e74ae9f0-…` | 79 Waverley, Telford |

Confirmed: all 3 rows resolve to the same known org (`e74ae9f0-8f54-4eff-8732-e7568b3d2e52`)
and to live V1 `properties` rows. No orphans, no multi-org spread → backfill is
trivial (3 inserts after `properties_v2` address bridge resolves).

---

## 4. `from('costs')` in `src/`

| Site | Op | Notes |
|---|---|---|
| `src/hooks/useProperties.ts:34` | **read** | nested `costs(*)` inside the `properties` parent select |
| `src/hooks/useProperties.ts:55` | **read** | nested `costs(*)` inside `useProperty` |
| `src/hooks/useProperties.ts:223` (`useUpsertCosts`) | **write** | `.upsert(costs, { onConflict: 'property_id,year' })` — only write surface |

Hook callers of `useUpsertCosts`:

- `src/components/costs/CostsEditor.tsx:16,43` — single UI surface for editing
  costs; submits `useUpsertCosts.mutate({ property_id, year, ... })`.

→ **One write surface in `src/`**: `useUpsertCosts` → `CostsEditor`.

---

## 5. `from('costs')` in `supabase/functions/`

| Site | Op | Notes |
|---|---|---|
| `supabase/functions/financial-forecast/index.ts:445` | **read** | per-property forecast — pulls all 6 manual + 3 calculated cols |
| `supabase/functions/portfolio-chat/tool-executor.ts:127` | **read** | `get_property_financials` tool |
| `supabase/functions/portfolio-chat/tool-executor.ts:290` | **read** | `portfolio_summary` tool |
| `supabase/functions/portfolio-chat/tool-executor.ts:574` | **read** | `risk_summary` tool |

→ **Zero edge-function writes** to `costs`. Only the financial-forecast +
portfolio-chat readers need redirecting to V2 (mirrors the loans §7.C surface
list almost exactly).

---

## 6. V2 schema gap analysis

Table does not exist — gap = **whole table**. The proposed §2 schema covers
parity (all 6 manual + 3 rule triplets preserved verbatim) plus the agreed
deltas (`org_id`, `tax_year text`, `deleted_at`).

No V1-only column is intentionally dropped. No new column is added beyond the
3 deltas.

---

## 7. Proposed 5-prompt sequence (mirror of #44–#48 for loans)

Note: because V2 doesn't yet exist, **A** here is "create + RLS" rather than
the loans #44 "fix the one-row pair drift" — there is nothing to reconcile yet.

| # | Title | Mirror | Notes |
|---|---|---|---|
| **A** | Create `property_cost_budgets_v2` + RLS + audit trigger + UNIQUE constraint | (new — replaces loans #44 pair-completeness, since there's no bridge yet) | Single migration. Add a smoke test asserting the table exists, RLS is enabled, and the unique key blocks dupes. |
| **B** | Stop V1 `costs` writes from `src/` — route `useUpsertCosts` through a new `useUpsertCostBudgetV2` | mirrors loans #45 | Only 1 surface (`CostsEditor`). Widen `throwV1Frozen` to accept `'costs'`. Switch the V1 hook to `throwV1Frozen('costs', 'useUpsertCosts')`. |
| **C** | Switch the 4 edge-function readers to V2 + a `costToLegacyShape` helper in `_shared/costBudget.ts` | mirrors loans #46 + #46b | Same pattern: `LOAN_FACILITY_SELECT` → `COST_BUDGET_SELECT`, embed nothing (no FK joins needed), map `tax_year text` back to legacy `year integer` for the math callers. Also port any `from('properties')` reads in those 4 sites that aren't already on `properties_v2` (per the #46b learning). |
| **D** | Backfill the 3 V1 rows into V2 + lock parity test | mirrors loans #44 (pair-completeness retrofitted here, post-write) | Single data-migration `INSERT INTO property_cost_budgets_v2 SELECT ... FROM costs JOIN properties JOIN properties_v2 (address bridge)`. Snapshot test: 3 V1 rows ↔ 3 V2 rows, same `(property_v2.id, '2026/27')` per row. |
| **E** | Install `v1_freeze_guard` trigger on `public.costs` + smoke test | mirrors loans #47 (#48 in the original numbering) | Idempotent `DO $$` block, identical pattern to the loans freeze migration shipped 2026-05-04. |

ABORT rules:
- Skip **C** if **B** isn't shipped (writes would still hit V1).
- Skip **E** if **B** + **C** + **D** aren't all shipped (freeze would break
  `CostsEditor` and the 4 edge readers).

---

## 8. David-decision — `year` shape

**V1**: `year integer` — all 3 rows are `2026`.

**V2 convention** (matches `tax_expenses.tax_year text`): UK tax-year string
`'YYYY/YY'`, e.g. `'2025/26'`.

The mapping at backfill time is the open decision. Two options:

- **Option 1 — calendar year (e.g. `2026 → '2026'`)**: trivial cast,
  but breaks alignment with `tax_expenses.tax_year` and forces every reader to
  branch on shape.
- **Option 2 — UK tax year (e.g. `2026 → '2026/27'`)**: aligned with
  `tax_expenses`, but requires a deterministic rule for "what UK tax year does
  the V1 integer mean?". Two sub-rules:
  - **2a**: integer = the *starting* calendar year → `2026 → '2026/27'`.
  - **2b**: integer = the *ending* calendar year → `2026 → '2025/26'`.

The same year-shape decision was flagged for `income` in the loans audit and
remains open there too — settling it once for both is the right move.

**Recommended for David**: **Option 2a** (`2026 → '2026/27'`). It matches the
convention used in the V2 wizards (`tax_year` defaults to current UK tax year
starting in April), keeps `tax_expenses` alignment, and is the rule the
existing CostsEditor copy already implies ("budget for the *upcoming* tax
year"). Confirm before Prompt **D**.

---

## 9. Summary

- **Total complexity**: small — confirmed (V2 design called for direct lift,
  3 V1 rows, 1 write surface in `src/`, 4 read surfaces in edge functions, no
  cross-org spread, no orphans).
- **V1 row count**: 3 (all in org `e74ae9f0-…`, all `year = 2026`).
- **V2 row count**: 0 — table doesn't exist yet.
- **Drift count**: N/A pre-bridge; post-Prompt-D the parity target is
  3-V1 ↔ 3-V2.
- **Recommended next Build prompt**: **Prompt A** — create
  `property_cost_budgets_v2` with the schema in §2, the standard org-member
  RLS, `UNIQUE (property_id, tax_year)`, and the V2 audit trigger. Block on
  the §8 David-decision before running Prompt **D**, but A/B/C/E can proceed
  immediately — none of them depend on the year-shape choice.

## Costs A — property_cost_budgets_v2 created 2026-05-04

Greenfield V2 table shipped — zero consumers pre-existed (`rg property_cost_budgets_v2 src/ supabase/functions/` returned nothing).

### Columns
- `id uuid PK DEFAULT gen_random_uuid()`
- `org_id uuid NOT NULL` → FK `legal_entities(id) ON DELETE CASCADE`
- `property_id uuid NOT NULL` → FK `properties_v2(id) ON DELETE CASCADE`
- `tax_year text NOT NULL` (UK starting-year rule, e.g. V1 `year=2026` → `'2026/27'`)
- Manual GBP buckets: `management_gbp_manual`, `bills_gbp_manual`, `insurance_gbp_manual`, `repairs_gbp_manual`, `compliance_gbp_manual`, `other_gbp_manual` (all `numeric DEFAULT 0`)
- Rule cols: `management_rule_enabled` / `management_rule_percent_of_rent` / `management_gbp_calculated`; same triplet for `repairs_*` and `insurance_*` (`insurance_rule_percent_of_value DEFAULT 0.3`)
- Audit: `created_at`, `updated_at` (auto-bump via `update_updated_at_column` trigger), `deleted_at` (soft-delete, nullable)

### Constraints
- PK `id`
- FK `org_id` → `legal_entities(id)` `ON DELETE CASCADE`
- FK `property_id` → `properties_v2(id)` `ON DELETE CASCADE`
- `UNIQUE (property_id, tax_year)` — canonical row per property-year
- Indexes on `org_id` and `property_id`

### RLS (4 policies)
Mirrors `loan_facilities` — all four operations gated by `public.user_has_org_access(org_id)`:
- `property_cost_budgets_v2_select` (USING)
- `property_cost_budgets_v2_insert` (WITH CHECK)
- `property_cost_budgets_v2_update` (USING)
- `property_cost_budgets_v2_delete` (USING)

### Consumers
Zero — confirmed clean greenfield. Backfill is Prompt D; consumer cutover is Prompts B and C.
