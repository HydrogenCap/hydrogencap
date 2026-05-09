## Properties §0b audit — biggest of the §0b 5

### 1. Data characterisation

| Metric | Today | #76 snapshot | Drift |
|---|---|---|---|
| V1 rows (`properties`) | **25** | 22 | +3 |
| V2 rows (`properties_v2`) | **27** | 22 | +5 |
| Overlap by id | **1** | — | 24 West St shadow row confirmed (only id-overlap from prior work; per #27 expectation otherwise disjoint) |
| V1-only ids | 24 | — | |
| V2-only ids | 26 | — | |

No `migrated_from_v1` sentinel column on V2. Both tables continue to drift, V2 faster than V1.

### 2. Schema mapping (83 V1 cols vs 69 V2 cols)

**34 V1-only cols, 20 V2-only cols.** Most V1 cols are either renames or DEAD; a handful are LIVE-but-missing-from-V2.

**Renames (V1 → V2, semantically equivalent):**

| V1 | V2 |
|---|---|
| `address_line` | `address_line_1` |
| `address_line2` | `address_line_2` |
| `town_city` | `city` |
| `has_gas` | `has_gas_supply` |
| `lifecycle_type` | `lifecycle_stage` |
| `purchase_price_gbp` | `purchase_price` |
| `original_purchase_date` | `purchase_date` |
| `current_value_gbp` | `current_valuation` |
| `last_valuation_date` | `valuation_date` |
| `is_grade_listed`+`listing_number` | `listing_grade` (existing V2) |
| `ownership_entity` | `entity_id` (FK now) |

**V1-only cols, candidate DEAD (no readers found in current code):**
`postcode_area`, `area_name`, `valuation_confidence`, `value_change_percent`, `last_valuation_estimate`, `heritage_notes`, `solar_*` (6 cols), `bathrooms`, `beds`, `has_gas` (legacy bool — superseded), `land_registry_link`, `legal_fees_gbp`, `stamp_duty_gbp`, `refurb_cost_gbp`, `other_acquisition_costs_gbp`, `capital_invested_gbp`, `ownership_percent`.

**V1-only cols, possibly LIVE (need confirmation in Q1):**
- `lease_years_remaining` — read by `useLeaseholdDetails.ts` (mixed-mode hook, lines 178-180); also written via leasehold flow elsewhere?
- `epc_rating` (also exists on V2) — written by `process-document/index.ts` L245 to V1 only. **This is a smoking gun.**

**V2-only cols (no V1 sibling):**
`address_line_1`, `address_line_2`, `city`, `council_area`, `council_name`, `entity_id`, `epc_expiry_date`, `has_gas_supply`, `hmo_licence_number`, `is_demo`, `lifecycle_stage`, `purchase_date`, `purchase_price`, `current_valuation`, `valuation_date`, `rent_basis`, `total_floors`, `total_lettable_rooms`, `whole_house_rent_pcm`, `year_built`.

### 3. Current writers/readers

**17 V1 refs across 13 files; 65 V2 refs across ~50 files.** Mixed-mode = 4 files.

| File | Reads V1 | Writes V1 | Reads V2 | Writes V2 | Classification |
|---|---|---|---|---|---|
| `useProperties.ts` (L156, L179) | ✅ | — | — | — | V1 read-only (legacy listings hook) |
| `useLeaseholdDetails.ts` (L170+178) | ✅ | — | ✅ | — | **Mixed-mode read** (V2-first + V1 fallback for `lease_years_remaining`) |
| `useInsuranceTracker.ts` (L371) | ✅ | — | — | — | V1 read-only (id+address probe) |
| `usePropertyPhotosV2.ts` (L21) | ✅ | — | ✅ | — | **Mixed-mode read** (V2-first + V1 photo lookup) |
| `process-document/index.ts` (L181, L188, L245) | ✅ | ✅ | ✅ | — | **🚨 SMOKING GUN — V1 EPC writer** |
| `bulk-price-paid-enrich/index.ts` (L245, L300) | ✅ | ✅ | — | — | **🚨 SMOKING GUN — pure V1 writer (purchase_price + 4 fields)** |
| `freeagent-sync-payments/index.ts` (L137, L172) | ✅ | — | ✅ | — | **Mixed-mode read** (V2-first + V1 fallback) |
| `summarize-valuation-document/index.ts` (L148) | ✅ | — | — | — | V1 read-only |
| `send-weekly-compliance-email/index.ts` (L410) | ✅ | — | — | — | V1 read-only |
| `send-tenant-certificates/index.ts` (L67) | ✅ | — | — | — | V1 read-only |
| `check-regulatory-changes/index.ts` (L144) | ✅ | — | — | — | V1 read-only |
| `categorise-documents/index.ts` (L280, L412) | ✅ | — | — | — | V1 read-only |
| `fetch-land-registry-comparables/index.ts` (L147) | ✅ | — | — | — | V1 read-only |
| `estimate-construction-year/index.ts` (L68) | ✅ | — | — | — | V1 read-only |
| `apply-passport-suggestions/index.ts` (L74) | ✅ | — | — | — | V1 read-only |
| `generate-passport-suggestions/index.ts` (L91) | ✅ | — | — | — | V1 read-only |

Critical: `v1_freeze_guard` is **already attached** as `BEFORE INSERT/UPDATE/DELETE` on `properties` (per #85). The guard `RAISE EXCEPTION`s with `EXCEPTION WHEN OTHERS NULL` wrapping the audit insert — so both writers above are **currently failing silently every time they fire**. `v1_freeze_violations` table has 0 entries for `properties` (audit insert is wrapped in EXCEPTION WHEN OTHERS, so logging is best-effort and may never have caught one). This needs investigation in Q2 below.

### 4. pg_depend analysis

**Functions referencing V1 properties:** ZERO function bodies query V1 `properties` (other than the trigger functions on V1 itself, which die with the table). The earlier scoping that flagged "functions referencing properties" was a false positive on `properties_v2` matches.

**Triggers on V1 properties (3, all die with table):**
- `audit_property_delete_trigger` — writes to `activity_log` on DELETE. V2 has its own audit system per memory; **dies with V1, no rewire needed**.
- `set_properties_updated_at` — generic timestamp; **dies with V1**.
- `v1_freeze_guard` — already installed; **dies with V1**.

**Views referencing V1 properties:** **ZERO.** Re-scanned all 9 candidates from #76 — `investor_commitment_detail`, `investor_return_metrics`, `property_annual_performance`, `loan_alerts`, etc. all reference `properties_v2`, not V1. **The "2 views need recreating" expectation in the brief is OUTDATED — already on V2.** Big win for the precursor scope.

**RLS policies on OTHER tables that JOIN V1 `properties` (15 total — these ARE the precursor):**

| Table | Policies | Pattern |
|---|---|---|
| `public.floorplans` | 4 (SELECT/INSERT/UPDATE/DELETE) | `EXISTS (FROM properties p WHERE p.id = floorplans.property_id AND user_has_org_access(p.org_id))` |
| `public.ownership_links` | 4 (SELECT/INSERT/UPDATE/DELETE) | CASE branch on `subject_type='PROPERTY'` then `EXISTS (FROM properties p ...)` |
| `storage.objects` | 7 (floorplans×3, photos×2, compliance×1, view×1) | `JOIN properties p ON memberships m ...` for path-based access |

All 15 are mechanically the same `properties → properties_v2` rewrite. Same shape as #73's tenant_portal precursor, just bigger volume. NOT non-trivial coupling — `properties_v2` has the same `id` and `org_id` cols.

### 5. Recommended ship sequence (estimate: 6–8 prompts)

```text
A   Kill V1 writers (2 smoking guns)               1 prompt
A.5 Validate v1_freeze_guard is actually firing    bundled with A
B   Backfill V2 with V1-only data (24 V1-only ids) 1 prompt — STOP-Q1 dependent
C1  Redirect V1-only readers wave 1 (8 edge fns,
    pure read-only, swap to properties_v2 with
    column rename map)                              1–2 prompts
C2  Redirect mixed-mode readers
    (useLeaseholdDetails, usePropertyPhotosV2,
     freeagent-sync-payments) to V2-only            1 prompt
C3  Redirect remaining src/ V1 readers
    (useProperties, useInsuranceTracker)            1 prompt
PRECURSOR  Rewrite 15 RLS policies on
    floorplans / ownership_links / storage.objects
    from `FROM properties p` to `FROM properties_v2 p`  1 prompt
E   Soak window (v1_freeze_guard already installed,
    just monitor v1_freeze_violations for ~1 week)
F   DROP TABLE properties (+ cleanup deps)         1 prompt
```

### 6. Open design questions

**Q1 — V1-only column LIVE/DEAD assessment.** Of the 34 V1-only cols, the brief calls for a per-column LIVE/DEAD verdict. Two specific concerns:
- `lease_years_remaining`: `useLeaseholdDetails` reads it. Either backfill to V2 (needs new V2 column) or migrate to existing `leasehold_details` table. Which?
- `solar_*` (6 cols): no readers found. Confirm DEAD before drop?
- Acquisition cost cols (`legal_fees_gbp`, `stamp_duty_gbp`, `refurb_cost_gbp`, `other_acquisition_costs_gbp`, `capital_invested_gbp`): no V2 equivalent. Drop or backfill into a `purchase_costs` JSONB column on V2?

**Q2 — Why are V1 writers not throwing user-visible errors?** `v1_freeze_guard` is `BEFORE` trigger that `RAISE EXCEPTION`s. `process-document` and `bulk-price-paid-enrich` should be hard-failing every invocation. Either:
- (a) The functions handle the error and continue silently (likely for `process-document` since it's a side-effect after main extraction succeeds);
- (b) The functions haven't been called recently enough to surface the breakage;
- (c) The trigger has a condition that excludes their writes.
Investigate as part of Ship A. Could be that compliance hasn't yet had an EPC processed since the freeze guard install date.

**Q3 — Backfill strategy.** V2 has 26 V2-only rows that don't exist in V1, V1 has 24 V1-only rows that don't exist in V2 (apart from the 1 shadow row). Are the 24 V1-only rows real properties that need migrating to V2 (Ship B), or are they legacy demo/test data that can be abandoned with the V1 drop?

**Q4 — Wave plan for Ship C.** 13 files touch V1. Should redirect happen as one big atomic ship (more risk) or 3 waves (C1: pure read-only edge fns, C2: mixed-mode, C3: src/ hooks)? Recommend 3 waves; confirm.

### Headline

Properties §0b is **bigger than compliance/share_classes but structurally cleaner**:
- ✅ ZERO function-body deps (vs 8 in compliance)
- ✅ ZERO view deps on V1 (the brief's "2 views" expectation was outdated — they're already on V2)
- ✅ `v1_freeze_guard` already installed
- ⚠️ 2 confirmed V1 writers in edge functions (smoking guns) currently failing silently
- ⚠️ 4 mixed-mode read hooks need V1 fallback removal once data is backfilled
- ⚠️ 15 RLS policies on floorplans/ownership_links/storage.objects need precursor rewrite (mechanical, same shape as #73)
- ⚠️ V1-only cols need LIVE/DEAD audit — `lease_years_remaining` is the one possibly-LIVE column without a V2 home

**Headline blocker is Q1 (V1-only column dispositions) + Q2 (writer-failure investigation).** Once those are resolved the ship plan is unambiguous.