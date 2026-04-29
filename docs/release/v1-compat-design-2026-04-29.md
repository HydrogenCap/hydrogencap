# V1 → V2 Compat Design — Properties (Stage C)

Date: 2026-04-29
Scope: properties only (rooms/tenants explicitly out of scope this pass)

## Context

The previous Stage C cleanup deleted `useRooms` and `useTenants` (zero importers
each) but found that `useProperties` (V1) had ~11 importers that consume the V1
read shape (`PropertyWithFinancials`). A mass mechanical migration was correctly
refused without a designed compat adapter. This document is that design.

## Existing surface

### V1 reader: `src/hooks/useProperties.ts`

Returns `PropertyWithFinancials[]` / `PropertyWithFinancials | null`:

```
PropertyWithFinancials = Tables['properties']['Row'] & {
  loans:     Tables['loans']['Row'][]
  income:    Tables['income']['Row'][]
  costs:     Tables['costs']['Row'][]
  tenancies: Tables['tenancies']['Row'][]
}
```

The V1 `properties` row has ~50 columns. The interesting ones (those actually
read by importers) are listed in the mapping table below.

### V2 reader: `src/hooks/usePropertiesV2.ts`

Returns `PropertyWithEntity[]` / `PropertyWithEntity | null` from the
`properties_v2` table joined to `legal_entities`. Exposes 30 columns.

### Existing compat: `src/hooks/usePropertiesCompat.ts`

Already shipped (built during the Aug 2026 V1→V2 migration). Reads
`properties_v2 + loan_facilities + property_annual_performance + tenancy_agreements`,
reshapes into V1 `PropertyWithFinancials`. Provides a list-only hook
(`usePropertiesCompat()`).

## Field-by-field mapping

Legend:
- **rename**     — field exists on both sides under different names
- **unchanged**  — field has the same name on both sides
- **derived**    — V1 field is computable from V2 fields
- **default**    — V2 has no source; compat returns a safe constant
- **V1-only**    — no V2 source AND a load-bearing importer reads it → BLOCKER
- **V2-only**    — V2 has it, V1 doesn't; not surfaced by compat

| V1 field                       | V2 source                                  | Class      | Notes |
| ------------------------------ | ------------------------------------------ | ---------- | ----- |
| `id`                           | `properties_v2.id`                         | unchanged  | |
| `org_id`                       | `properties_v2.org_id`                     | unchanged  | |
| `address_line`                 | `properties_v2.address_line_1`             | rename     | |
| `address_line2`                | `properties_v2.address_line_2`             | rename     | |
| `town_city`                    | `properties_v2.city`                       | rename     | |
| `area_name`                    | `properties_v2.city`                       | rename     | duplicates `town_city` in V2 |
| `postcode`                     | `properties_v2.postcode`                   | unchanged  | |
| `county`                       | `properties_v2.county`                     | unchanged  | |
| `country`                      | `properties_v2.country`                    | unchanged  | |
| `property_type`                | `properties_v2.property_type`              | unchanged  | |
| `latitude`                     | `properties_v2.latitude`                   | unchanged  | |
| `longitude`                    | `properties_v2.longitude`                  | unchanged  | |
| `current_value_gbp`            | `properties_v2.current_valuation`          | rename     | |
| `purchase_price_gbp`           | `properties_v2.purchase_price`             | rename     | |
| `purchase_date`                | `properties_v2.purchase_date`              | unchanged  | |
| `notes`                        | `properties_v2.notes`                      | unchanged  | |
| `created_at` / `updated_at`    | `properties_v2.*`                          | unchanged  | |
| `last_valuation_date`          | `properties_v2.valuation_date`             | rename     | |
| `last_valuation_estimate`      | `properties_v2.current_valuation`          | rename     | |
| `capital_invested_gbp`         | `properties_v2.purchase_price`             | derived    | proxy; true value also includes refurb |
| `beds`                         | `properties_v2.total_lettable_rooms`       | derived    | rough proxy (rooms ≠ bedrooms strictly) |
| `has_gas`                      | `properties_v2.has_gas_supply`             | rename     | |
| `is_grade_listed`              | `properties_v2.listing_grade !== 'none'`   | derived    | |
| `listing_grade`                | `properties_v2.listing_grade`              | unchanged  | |
| `lifecycle_type`               | `properties_v2.lifecycle_stage`            | derived    | `letting`/`stabilised` → `core_rental`, else `development` |
| `formatted_address`            | concatenation of address_line_1/city/pc    | derived    | |
| `bathrooms`                    | —                                          | default    | always `null` |
| `is_hmo_licensed`              | —                                          | default    | always `null` |
| `epc_rating`                   | —                                          | default    | V2 keeps EPC on `property_passport`; not joined here |
| `conservation_area`            | —                                          | default    | always `false` |
| `legal_owner_company_id`       | —                                          | **V1-only** | V2 ownership lives in `ownership_links` join, not a column |
| `legal_owner_party_id`         | —                                          | **V1-only** | as above |
| `tenure`                       | —                                          | **V1-only** | freehold/leasehold lives on `property_passport` in V2 |
| `geocode_status`               | —                                          | **V1-only** | V2 has no per-row geocode status (always-on geocoder) |
| `geocode_error`                | —                                          | **V1-only** | as above |
| `property_name`                | —                                          | **V1-only** | Optional friendly name; no V2 column |
| `uprn`                         | —                                          | **V1-only** | Lives on `property_passport` in V2 |
| `planning_authority`           | —                                          | **V1-only** | Now lives in `local_authorities` link table |
| `listed_status` (string label) | —                                          | **V1-only** | V2 has `listing_grade` enum, not the legacy text label |
| `postcode_area`                | derive from `postcode`                     | derived    | not currently surfaced; omit |
| `place_id`                     | —                                          | V1-only    | Google Places id; only used in writes (already frozen) |
| `loans[]`                      | `loan_facilities` (active/drawdown)        | rename     | column-by-column rename in `mapLoanToV1` |
| `income[]`                     | `property_annual_performance` (current yr) | derived    | single synthetic row per property |
| `costs[]`                      | `property_annual_performance` (current yr) | derived    | single synthetic row, no per-category split |
| `tenancies[]`                  | `tenancy_agreements` (active/pending/notice) | rename   | `notice_period` → `notice` |

V2-only (not surfaced by compat): `entity_id`, `entity_name`, `entity_type`,
`council_name`, `council_area`, `total_floors`, `year_built` (V1 also has this
but as a passport field), `whole_house_rent_pcm`, `rent_basis`,
`epc_expiry_date` (already on the V1 row but unused).

## Importer survey (all 11 sites)

Read sites — what each destructures:

| File | V1 fields read | Status |
| ---- | -------------- | ------ |
| `passport/CoreIdentityCard.tsx` | `property_name`, `address_line`, `address_line2`, `town_city`, `county`, `postcode`, `uprn`, `planning_authority`, `property_type`, `listed_status`, `conservation_area` | **BLOCKED** — 5 V1-only fields |
| `ownership/LegalOwnerCard.tsx` | `legal_owner_company_id` | **BLOCKED** — UI keys off this column |
| `ownership/DerivedBeneficialOwnershipCard.tsx` | `legal_owner_company_id`, `legal_owner_party_id` | **BLOCKED** |
| `ownership/LegalOwnershipEditor.tsx` | property + `useUpdateProperty` (frozen) | **BLOCKED** — also writes V1 |
| `settings/LocationSettingsTab.tsx` | `geocode_status`, `geocode_error`, `latitude`, `address_line`, `postcode` | **BLOCKED** — entire tab is about V1 geocode lifecycle |
| `pages/PropertyNew.tsx` | only writes (frozen) | **N/A — frozen write path** |
| `pages/PropertyEdit.tsx` | property read + frozen writes | **BLOCKED** — writes will throw at runtime, do not touch shape |
| `missing-info/MissingInfoPropertyRow.tsx` | property read + frozen writes | **BLOCKED** — same |
| `property/LifecycleSwitcher.tsx` | `lifecycle_type` plus `validatePropertyData(property,…)` which reads `legal_owner_company_id`, `tenure` | **BLOCKED** via validator |
| `property/GoLiveChecklist.tsx` | `lifecycle_type`, `address_line` plus `validatePropertyData(property,…)` | **BLOCKED** via validator |
| `costs/CostsEditor.tsx` | `useUpsertCosts` only — no read | **N/A — V1 primitive write, retained intentionally** |

## Decision

Every read importer is blocked by at least one field with no V2 derivation.
Per the prompt's directive ("If any V1-only field has NO clean derivation … do
NOT modify those importers"), **zero importers are migrated this pass**.

What we *can* still ship usefully:

1. The mapping table above (this doc) — concrete blockers for the V2 backlog.
2. A singular `usePropertyCompat(id)` to mirror the existing list compat hook,
   so the moment any blocking column lands in V2 we can switch the importer
   in one line.
3. A V1-only-field access tracker: when consumer code reads a V1-only field
   off a compat result, log a `console.warn` once per session per field, so
   developers can grep to see what's still load-bearing.
4. Unit tests for the compat shape (renames, derived fields, warning
   behaviour, V2 extras suppressed).

`useProperties.ts` (V1) **stays** because:
- 7 reads are blocked (above).
- 4 importers use `useUpsertCosts` / `useUpsertIncome` / `useCreateLoan` /
  `useUpdateLoan`, which are still active V1 primitives (Plan §0a; they have
  no V2 equivalent yet).
- 5 importers depend on the now-frozen mutations; rewriting them is real V2
  work, not a compat swap.

## Uncertain — V1-only fields blocking full cutover

Each of these blocks ≥1 importer. Listed in priority order for V2 schema work:

1. **`legal_owner_company_id`** / **`legal_owner_party_id`** — blocks 4 sites
   (3 read, 1 read+write). V2 should expose a derived view or column joining
   `ownership_links` to `properties_v2`.
2. **`tenure`** (freehold/leasehold/share-of-freehold) — blocks 2 sites via
   `validatePropertyData`. Currently lives on `property_passport`; either
   surface it on `properties_v2` or update the validator to take passport.
3. **`geocode_status`** / **`geocode_error`** — blocks `LocationSettingsTab`.
   V2 needs an audit/status column or this tab moves to a different model.
4. **`property_name`**, **`uprn`**, **`planning_authority`**,
   **`listed_status`** (text) — block `CoreIdentityCard`. Some live on
   `property_passport` already; this card needs a V2-native rewrite.

## Out of scope (explicitly preserved)

- `useRooms` / `useTenants` — already deleted in the prior pass.
- `useCreateLoan`, `useUpdateLoan`, `useUpsertIncome`, `useUpsertCosts` —
  active V1 primitives; not frozen, not migrated this pass.
- The frozen V1 mutations (`useCreateProperty`, `useUpdateProperty`,
  `useDeleteProperty`) stay declared so the call sites still compile and
  surface a clear runtime error rather than a build break.
