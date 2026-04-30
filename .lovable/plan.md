
# V1→V2 FK Drift Audit Report — Plan

Single deliverable: write **`docs/release/v1-v2-fk-drift-2026-04-30.md`**. No source edits, no migrations, no schema changes. All data below was collected read-only from `pg_constraint` / `pg_attribute` / `pg_policies` and from row-count probes against the live DB.

---

## Headline finding (bigger than expected)

The V1 and V2 id spaces are **almost completely disjoint**:

| Pair | V1 rows | V2 rows | Shared id |
|---|---|---|---|
| `properties` ↔ `properties_v2` | 25 | 27 | **1** (the shadow row inserted earlier this week) |
| `companies` ↔ `legal_entities` | 19 | 22 | **0** |
| `tenants` ↔ `tenants_v2` | 3 | 3 | **0** |
| `rooms` ↔ `rooms_v2` | 17 | 23 | (not probed — assume disjoint) |
| `share_classes` ↔ `share_classes_v2` | 19 | 19 | (assume disjoint) |
| `compliance_documents` ↔ `compliance_documents_v2` | 117 | 140 | (assume disjoint) |

**Implication:** every dependent table that still FKs to a V1 table is either (a) full of legacy V1-only rows that need a remap, or (b) cannot be re-pointed without an id-translation table. There is **no** "safe-bucket FK" that can be flipped with zero data movement, contrary to the prompt's optimistic assumption.

---

## Step 3 — strict V2→V1 FKs (constraint table is V2, referent is V1)

Exactly **one** FK satisfies the strict definition (from-table is `_v2` or `legal_entities`, to-table is a V1 mirror):

| FK | Drift count | Bucket |
|---|---|---|
| `properties_v2.legal_owner_company_id → companies(id)` `ON DELETE SET NULL` | **21 / 21** populated rows orphan if re-pointed to `legal_entities` | drift-prone |

All 21 `properties_v2` rows that have an owner currently point at a `companies.id` that has no matching `legal_entities.id`. A naive constraint swap would fail; a remap is required first.

## Class B — V-neutral tables that still FK to a V1 table with a V2 sibling

The user explicitly cited `photos.property_id → properties` as part of the drift class even though `photos` is V-neutral. Including all such FKs:

| FK | Drift count (rows that would orphan vs V2 sibling) | populated_total | Bucket |
|---|---|---|---|
| `photos.property_id → properties` CASCADE | **30** | 33 | drift-prone (the new 24 West Street rows are the 3 that *would* survive) |
| `floorplans.property_id → properties` CASCADE | 1 | 2 | drift-prone |
| `documents.property_id → properties` SET NULL | **179** | 179 | drift-prone (every doc) |
| `documents.tenant_id → tenants` CASCADE | 14 | 14 | drift-prone |
| `documents.company_id → companies` CASCADE | 21 | 21 | drift-prone |
| `documents.ai_suggested_property_id → properties` SET NULL | (assume = property_id pattern) | — | drift-prone |
| `maintenance_requests.property_id → properties` RESTRICT | 0 | 0 | cosmetic (table empty on V1 side) |
| `maintenance_requests.tenant_id → tenants` NO ACTION | 0 | 0 | cosmetic |
| `maintenance_requests.room_id → rooms` NO ACTION | 0 | 0 | cosmetic |
| `shareholdings.company_id → companies` CASCADE | 21 | 21 | drift-prone |
| `shareholdings.share_class_id → share_classes` CASCADE | 21 | 21 | drift-prone |
| `company_metric_snapshots.company_id → companies` CASCADE | 0 | 0 | cosmetic |
| `freeagent_connections.company_id → companies` CASCADE | 0 | 0 | cosmetic |
| `property_beneficial_owners.company_id → companies` CASCADE | 3 | 3 | drift-prone |
| `property_beneficial_owners.property_id → properties` CASCADE | 9 | 9 | drift-prone |
| `property_legal_ownership.owning_company_id → companies` SET NULL | 3 | 3 | drift-prone |
| `property_legal_ownership.property_id → properties` CASCADE | 6 | 6 | drift-prone |
| `property_ownership.property_id → properties` CASCADE | 26 | 26 | drift-prone |
| `property_passport.property_id → properties` CASCADE | 24 | 24 | drift-prone |
| `tenant_portal_access.tenant_id → tenants` CASCADE | 0 | 0 | cosmetic |
| `tenant_portal_invites.tenant_id → tenants` CASCADE | 0 | 0 | cosmetic |
| `document_share_links.compliance_document_id → compliance_documents` CASCADE | 0 | 0 | cosmetic |

Plus the never-cleaned property children: `activity_log`, `capex_projects`, `comparable_sales.source_property_id`, `compliance_items`, `contractor_jobs`, `dismissed_duplicates` (×2), `document_summaries`, `go_live_checklists`, `inbound_emails.matched_property_id`, `insurance_policies`, `leasehold_details`, `passport_autofill_suggestions`, `passport_field_audit`, `property_title_numbers`, `property_valuations`, `refinancing_opportunities`, `valuation_alerts`, `void_periods` — all FK to V1 `properties`. These are not yet in the drift-count probe; the report will note them as "V1-only descendants pending audit" rather than re-point candidates.

## Bucket summary

- **Safe bucket (re-point with no data movement):** **none.** Every drift-prone FK has live V1 rows that don't exist in V2.
- **Cosmetic bucket (V1 referent has zero referencing rows):** 8 FKs — `maintenance_requests.{property,tenant,room}_id`, `tenant_portal_access.tenant_id`, `tenant_portal_invites.tenant_id`, `company_metric_snapshots.company_id`, `freeagent_connections.company_id`, `document_share_links.compliance_document_id`. **These can ship as a single batched migration today** — drop and re-add against the V2 sibling. Zero rows affected, but it stops new writes drifting.
- **Drift-prone bucket:** the remaining ~14 FKs. Each needs an id-remap table (V1 id → V2 id, by address/postcode for properties, by name/companies-house for companies, by tenant name+email for tenants) **before** the constraint swap. Cannot be batched.

## RLS rewrite scope (search of pg_policies)

Re-pointing `*.property_id → properties_v2` will require rewriting RLS qual/with_check on these dependent tables (each currently joins through V1 `properties`):

`costs`, `floorplans`, `go_live_checklists`, `income`, `insurance_policies`, `loans`, `passport_autofill_suggestions`, `passport_field_audit`, `photos`, `property_beneficial_owners`, `property_legal_ownership`, `property_ownership`, `property_passport`, `property_title_numbers`. ~60 policies in total; the migration must drop and recreate each one in the same transaction or RLS will deny all reads mid-flight.

Re-pointing `*.company_id → legal_entities` affects: `company_metric_snapshots`, `ownership_links`, `shareholdings`. ~12 policies.

## Per-FK detail format (sample)

Each FK gets a block in the report. Sample for `properties_v2.legal_owner_company_id`:

```sql
-- Current
ALTER TABLE properties_v2 DROP CONSTRAINT properties_v2_legal_owner_company_id_fkey;
-- Target (after remap of 21 rows from companies.id → legal_entities.id)
ALTER TABLE properties_v2
  ADD CONSTRAINT properties_v2_legal_owner_company_id_fkey
  FOREIGN KEY (legal_owner_company_id)
  REFERENCES legal_entities(id) ON DELETE SET NULL;
```
Blast radius: re-pointing without remap = 21 rows fail FK validation, ALTER aborts. With remap = 21 owners now correctly resolve to legal entities; nothing breaks. RLS impact: none (column not used in any policy qual).

## Step 7 — what to do next (one-line recommendation)

**Ship the cosmetic bucket first** (8 FKs, zero rows touched, no RLS rewrites — pure constraint swap) as the next Build prompt; **handle each drift-prone FK individually** with a paired remap table — start with `properties_v2.legal_owner_company_id` (smallest blast radius, 21 rows, well-bounded `companies → legal_entities` mapping by name/companies_house_number).

---

## What the build step will do

1. Create the file `docs/release/v1-v2-fk-drift-2026-04-30.md` containing all the tables/blocks above in full prose (not abbreviated as in this plan).
2. Nothing else — no `supabase/migrations/`, no `src/` edits, no `types.ts` touch.

**Approve and I'll write the report.**
