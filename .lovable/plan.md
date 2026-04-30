
# Plan — append §7 to `docs/release/v1-v2-fk-drift-2026-04-30.md`

## What changes

**Single file edit, docs only.** Append a new `## 7. V1-only descendant FK audit (Class B continuation)` section to `docs/release/v1-v2-fk-drift-2026-04-30.md`. **No code, no schema, no migrations.**

The 19 FKs listed in §2 under "V1-only descendants pending audit" have now been drift-counted via `pg_constraint` + per-FK `EXISTS (SELECT 1 FROM properties_v2 WHERE v.id = <from_table>.<from_column>)` queries. Results below feed the new section verbatim.

## Drift table to write into §7

V1 `properties` has 25 rows; `properties_v2` has 27 rows. Id spaces are disjoint, so any populated FK pointing at V1 `properties` is automatically 100% drift unless the row count is 0.

| from_table.from_column | populated | drift | bucket |
|---|---:|---:|---|
| `activity_log.property_id` | 208 | **208** | drift-prone |
| `compliance_items.property_id` | 117 | **117** | drift-prone |
| `passport_autofill_suggestions.property_id` | 22 | **22** | drift-prone (RLS) |
| `property_title_numbers.property_id` | 22 | **22** | drift-prone (RLS) |
| `go_live_checklists.property_id` | 18 | **18** | drift-prone (RLS) |
| `insurance_policies.property_id` | 18 | **18** | drift-prone (RLS) |
| `passport_field_audit.property_id` | 18 | **18** | drift-prone (RLS) |
| `contractor_jobs.property_id` | 5 | 5 | drift-prone |
| `dismissed_duplicates.property_id_1` | 2 | 2 | drift-prone |
| `dismissed_duplicates.property_id_2` | 2 | 2 | drift-prone |
| `property_valuations.property_id` | 2 | 2 | drift-prone |
| `refinancing_opportunities.property_id` | 2 | 2 | drift-prone |
| `valuation_alerts.property_id` | 2 | 2 | drift-prone |
| `capex_projects.property_id` | 0 | 0 | cosmetic (empty from_table) |
| `comparable_sales.source_property_id` | 0 | 0 | cosmetic |
| `document_summaries.property_id` | 0 | 0 | cosmetic |
| `inbound_emails.matched_property_id` | 0 | 0 | cosmetic |
| `leasehold_details.property_id` | 0 | 0 | cosmetic |
| `void_periods.property_id` | 0 | 0 | cosmetic |

Totals: **13 drift-prone (438 rows total to remap)**, **6 cosmetic (zero rows in from_table — pure constraint swap)**, **0 safe**. None of the 19 are "safe" in the sense the user defined (drift=0 with rows present); rows-present and drift=0 never co-occur because id spaces are disjoint.

## §7 sub-sections to write

### 7.1 Bridge candidate per FK
All 19 are property-keyed → single bridge: `tmp_property_id_remap (v1_id, v2_id, match_strategy)`, populated by:
1. **Exact**: lower(trim(v1.address_line)) = lower(trim(v2.address_line_1)) AND lower(trim(v1.postcode)) = lower(trim(v2.postcode)).
2. **Postcode + leading-house-number fuzzy** fallback (proven in Prompt #31's `25 Arle Gardens` case).
3. **Identity** for the `24 West Street` shadow row.

This is **the same bridge used by Prompts #28, #31** — can be lifted verbatim.

### 7.2 Batchability
All 13 drift-prone FKs share the property_id remap pattern → **one tmp table, multiple ALTER+UPDATE pairs in one transaction**. Cosmetic 6 can ride along (no UPDATE needed) or ship separately. No company- or tenant-keyed FKs in this set, so no second bridge is needed.

### 7.3 RLS lockstep impact
Confirmed via `pg_policies` scan — **5 of the 13 drift-prone FKs have policies that join V1 `properties`**:
- `go_live_checklists` (3 policies)
- `insurance_policies` (5 policies)
- `passport_autofill_suggestions` (4 policies)
- `passport_field_audit` (2 policies)
- `property_title_numbers` (4 policies)

Total: **~18 policies must be dropped + recreated to join `properties_v2 p` instead** in the same transaction as the FK swap. The other 8 drift-prone tables (`activity_log`, `compliance_items`, `contractor_jobs`, `dismissed_duplicates`, `property_valuations`, `refinancing_opportunities`, `valuation_alerts`) use direct `org_id` policies or no V1-properties join — no RLS rewrite needed.

### 7.4 Recommended Build sequencing (3 prompts)

```text
Prompt #33 (Class-B Batch 2 — high-volume, no RLS):
  activity_log.property_id          (208 rows, CASCADE)
  compliance_items.property_id      (117 rows, CASCADE)
  contractor_jobs.property_id       (5 rows,   CASCADE)
  property_valuations.property_id   (2 rows,   CASCADE)
  refinancing_opportunities.property_id (2,    CASCADE)
  valuation_alerts.property_id      (2 rows,   CASCADE)
  dismissed_duplicates.property_id_1 + _2 (2+2, CASCADE)
  → 1 tmp_property_id_remap, 8 ALTER+UPDATE pairs, zero RLS rewrites.
  → 338 rows backfilled.

Prompt #34 (Class-B Batch 3 — RLS-coupled, passport stack):
  passport_autofill_suggestions.property_id (22, CASCADE) + 4 policies
  passport_field_audit.property_id          (18, CASCADE) + 2 policies
  property_title_numbers.property_id        (22, CASCADE) + 4 policies
  → 62 rows backfilled, 10 policies rewritten in lockstep.
  → Same passport-page test surface — easy single-page smoke test.

Prompt #35 (Class-B Batch 4 — RLS-coupled, ops stack):
  go_live_checklists.property_id    (18, CASCADE) + 3 policies
  insurance_policies.property_id    (18, CASCADE) + 5 policies
  → 36 rows backfilled, 8 policies rewritten.
  → Property-detail page (Insurance + Activation tabs) smoke test.

Prompt #36 (Cosmetic sweep — zero rows, optional):
  capex_projects, comparable_sales, document_summaries,
  inbound_emails, leasehold_details, void_periods
  → 6 pure constraint swaps, no UPDATE, no RLS rewrites.
  → Can also be folded into Prompt #33 since neither touches data.
```

Sequencing rationale: #33 first (biggest blast radius, simplest mechanically — no RLS), then #34 and #35 (smaller volume but each carries its own RLS test surface, kept separate so a failed policy rewrite only takes one page dark). #36 is a janitorial sweep.

### 7.5 PostgREST embed risk
None of the 19 from_tables currently have multiple FKs into `properties` / `properties_v2` simultaneously (verified — these are single-FK tables). So the disambiguator pattern from Prompt #30 is **not needed** for any of these batches. Pre-emptive scan: after re-pointing, none of the from_tables will gain a second FK to `properties_v2`.

### 7.6 Final paragraph (Step 8)
Of the 19 V1-only-descendant FKs flagged in §2, **13 are drift-prone (438 rows total to remap)** and **6 are cosmetic (zero rows in the from_table)**; **none are safe** because the disjoint id spaces guarantee that any populated FK pointing at V1 `properties` is 100% drift. Recommended next Build prompt: **#33 — Class-B Batch 2** covering the 8 high-volume FKs with zero RLS impact (`activity_log`, `compliance_items`, `contractor_jobs`, `property_valuations`, `refinancing_opportunities`, `valuation_alerts`, `dismissed_duplicates.property_id_1`, `dismissed_duplicates.property_id_2`) using the proven `tmp_property_id_remap` bridge, optionally bundling the 6 cosmetic FKs into the same transaction.

## Constraints respected
- Read-only audit complete via `pg_constraint`, `pg_policies`, and per-table `EXISTS` queries.
- No `src/`, no `supabase/migrations/`, no schema changes.
- Single deliverable: append §7 (~5 KB) to existing report.
- All §7 numbers are sourced from live DB queries run during this audit, not estimates.
