# Plan — V2 Replacement Design Report

**Note on mode:** Plan mode forbids writing to `docs/release/`. Approving this plan switches to Build mode and writes the single deliverable file `docs/release/v2-design-loans-income-costs-tenancies-2026-04-30.md`. **No code, schema, migrations, or tests will change** — only the new markdown report.

---

## Headline finding from the audit

A pre-flight scan of `information_schema.tables` revealed that **the team has already shipped V2 siblings for 3 of the 4 tables, populated with row counts that match V1**:

| V1 table | V1 rows | Existing V2 sibling | V2 rows | Status |
|---|---:|---|---:|---|
| `loans` | 24 | **`loan_facilities`** | 24 | Functional shell + matching data — needs reconciliation |
| `tenancies` | 13 | **`tenancy_agreements`** | 13 | Functional shell + matching data — needs reconciliation |
| `costs` | 3 | **`tax_expenses`** | 0 | Different shape (line-item vs annual buckets) — partial only |
| `income` | 21 | **none** | — | True greenfield |

This reframes the work from "design 4 V2 tables" to "promote 3 existing V2 siblings + design 1 greenfield + design a thin annual-cost overlay".

---

## Table-by-table summary (full detail in the file once approved)

### 1. `loans` → promote `loan_facilities`
- **Consumers:** 3 write paths in `src/` (`useProperties.ts:151,183`, `useBatchImport.ts:107,116`, `useBulkPropertyUpdate.ts:51`); 7 read-only edge functions (`portfolio-chat/{tools,tool-executor}`, `portfolio-api`, `analyse-acquisition`, `generate-ai-valuation`, `generate-investor-report`, `financial-forecast`).
- **Schema gap (4 fields V1 has, V2 lacks):** `refinance_target_date`, `broker_name`, `broker_contact`, `payment_override_gbp` + `payment_source`. ALTER required.
- **V2 already adds 12 fields V1 doesn't have** (LTV, ICR/LTV covenants, ERC, fees, `lender_id`, `entity_id`).
- **No inbound FKs.** Lowest-risk medium item.

### 2. `income` → design `property_income_budgets_v2` (greenfield)
- **Consumers:** 2 writes (`useProperties.ts:227`, `useBatchImport.ts:135`); 4 reads (`analyse-acquisition`, `generate-investor-report`, `financial-forecast`, `portfolio-chat/tool-executor`).
- **Why no V2 sibling:** live tenancy already covers current rent; V1 `income` is for *historical year-by-year overrides* used in forecasting/scenarios — concept the live graph cannot replicate.
- **Proposed columns:** `id, org_id, property_id (→ properties_v2 CASCADE), tax_year text, annual_rent_gbp, rent_source CHECK ('manual'|'derived_from_tenancy'|'derived_from_market'), notes, audit + deleted_at, UNIQUE(property_id, tax_year)`.
- **Risk:** `year` int → `tax_year` text mapping ambiguous (calendar vs UK tax year — needs David's call).

### 3. `costs` → design `property_cost_budgets_v2` (greenfield, separate from `tax_expenses`)
- **Consumers (smallest):** 1 write (`useProperties.ts:258`); 2 reads (`financial-forecast`, `portfolio-chat/tool-executor`).
- **Why `tax_expenses` is *not* a replacement:** `tax_expenses` is line-item actuals for tax filing; `costs` is annual budget overrides + rule-driven autocalculations (management = 5% rent, etc.). They should coexist (budgets vs actuals).
- **Proposed columns:** direct lift of V1's 6 manual buckets + 6 rule columns, with `org_id` added and `year` int → `tax_year` text.

### 4. `tenancies` → promote `tenancy_agreements` (heaviest)
- **Consumers (biggest):** 7 in `src/` (`useTenancies.ts:119,147` writes; `usePropertyPnL`, `useRoomPnL`, `useDocumentManagement`, `useBatchRenameDocuments`, plus 3 portal pages); 5 edge (`send-rent-reminder`, `send-tenant-certificates`, `send-tenancy-expiry-reminders`, `auto-generate-rent-schedule`, `portfolio-chat/tool-executor`).
- **Schema gap (5 fields V1 has, V2 lacks):** `rent_due_day`, `tenancy_agreement_url`, `notice_period_weeks`, `payment_method`, `payment_reference`.
- **Inbound FK tax (CRITICAL):** 7 child tables CASCADE-FK into `tenancies.id`: `documents`, `payment_reminders`, `rent_payments`, `rent_schedule`, `tenancy_compliance_items`, `tenant_portal_access`, `tenant_portal_invites`. All need lockstep re-point.
- **RLS:** SECURITY DEFINER `user_has_tenancy_portal_access(uuid)` joins through V1 `tenancies` — **must be rewritten in the same transaction** as the FK re-points or the entire tenant portal goes dark mid-flight.

---

## Cross-table FK touch points (Step 4)

After replacements ship, these existing V2 tables gain new/rebound FKs:

- `documents.tenancy_id`, `payment_reminders.tenancy_id`, `rent_payments.tenancy_id`, `rent_schedule.tenancy_id`, `tenancy_compliance_items.tenancy_id`, `tenant_portal_access.tenancy_id`, `tenant_portal_invites.tenancy_id` → `tenancy_agreements.id` (mandatory, lockstep).
- Optional new: `property_legal_ownership.loan_id` → `loan_facilities.id`; `tax_expenses.cost_budget_id` → `property_cost_budgets_v2.id`; `compliance_documents_v2.tenancy_id` → `tenancy_agreements.id`.

---

## Recommended sequencing

1. **`costs` → `property_cost_budgets_v2`** — *small*. One Build prompt. Warm-up using the proven Class-B template.
2. **`income` → `property_income_budgets_v2`** — *small/medium*. One Build prompt (after David confirms tax-year semantics).
3. **`loans` → promote `loan_facilities`** — *medium*. One Build prompt if V1↔V2 row diff is clean; two if drift is found.
4. **`tenancies` → promote `tenancy_agreements`** — *large*. **Three Build prompts**:
   - 4a: ALTER + pre-flight diff + backfill missing fields.
   - 4b: Re-point 7 inbound FKs + rewrite `user_has_tenancy_portal_access` + RLS rewrite (single transaction; preview smoke-test before merge).
   - 4c: Cutover 3 cron jobs + 5 portal pages + `useTenancies`. Freeze V1 last.

---

## Final paragraph (Step 8)

Shipping order: **(1) `costs` — small, (2) `income` — small/medium, (3) `loans` — medium, (4) `tenancies` — large**. Items 3 and 4 are *promotions* of pre-existing V2 siblings (`loan_facilities`, `tenancy_agreements`) with row counts already matching V1, so most of the work is reconciling 4–5 missing columns per table and re-pointing consumers; items 1 and 2 are true greenfield V2 designs.

---

## On approval

Build mode will write the full report to `docs/release/v2-design-loans-income-costs-tenancies-2026-04-30.md` (~13 KB) containing every section above plus the per-FK detail tables, RLS impact analysis, full field-mapping tables, and consumer line refs already gathered. **No `src/`, schema, or migration changes.**
