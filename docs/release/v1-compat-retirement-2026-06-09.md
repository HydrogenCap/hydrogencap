# V1 → V2 Compat Retirement

The compat shims `src/hooks/compat/usePropertyCompat.ts` and
`src/hooks/usePropertiesCompat.ts` are being retired. They reshape
`properties_v2` rows into the legacy V1 `PropertyWithFinancials` shape and
stitch in mapped `loans` / `income` / `costs` / `tenancies` arrays.

This document tracks the migration and the field map every consumer needs.

## Drop-in replacement

| V1 compat hook                | V2-native replacement                              |
| ----------------------------- | -------------------------------------------------- |
| `usePropertyCompat(id)`       | `usePropertyV2(id)` (from `@/hooks/usePropertiesV2`) |
| `usePropertiesCompat()`       | `usePropertiesV2WithFinancials()` (from `@/hooks/usePropertiesV2WithFinancials`) |

Both replacements return data with the same `loans` / `income` / `costs` /
`tenancies` nested shape as the compat layer, so per-row card / chart / row
templates are **unchanged**. Only the property-level field names change.

## Field map

| V1 (compat shape)        | V2 source                                          |
| ------------------------ | -------------------------------------------------- |
| `address_line`           | `address_line_1`                                   |
| `address_line2`          | `address_line_2`                                   |
| `town_city`, `area_name` | `city`                                             |
| `current_value_gbp`      | `current_valuation`                                |
| `purchase_price_gbp`     | `purchase_price`                                   |
| `capital_invested_gbp`   | `purchase_price`                                   |
| `last_valuation_date`    | `valuation_date`                                   |
| `last_valuation_estimate`| `current_valuation`                                |
| `has_gas`                | `has_gas_supply`                                   |
| `beds`                   | `total_lettable_rooms`                             |
| `is_grade_listed`        | `listing_grade !== 'none'` — use `isGradeListed()` |
| `lifecycle_type`         | derived — use `lifecycleType()`                    |
| `formatted_address`      | derived — use `formattedAddress()`                 |

Derived helpers live in `src/lib/v2FieldAccessors.ts`. They reproduce the
compat layer expressions byte-for-byte so behaviour is preserved.

## Fields with no direct V2 source

The compat layer returned `null` / safe defaults for these. Consumers that
need real values must read from `property_passport` via
`usePassportPageData`:

- `bathrooms`
- `is_hmo_licensed`
- `conservation_area`
- `legal_owner_company_id`, `legal_owner_party_id`

> **Note**: `epc_rating` _is_ available on `properties_v2` directly — the
> compat comment claiming otherwise is stale.

## Guard rail

`eslint.config.js` blocks new imports of either compat hook via a
`no-restricted-imports` rule. A file-level override allow-lists the
existing consumers; remove a file from the override list as it migrates
to the V2-native hook. Never add an entry back.

## Migration order

The shims can be deleted only after the override list is empty. Suggested
sequence (foundation → consumers → delete):

1. `src/lib/{metricsConfig,propertyMetrics,portfolioStats,portfolioInsights,csvExporter,bankPresentationGenerator}.ts` + their tests.
2. `src/components/dashboard/**` + `src/components/maps/PropertyMap.tsx` + `src/components/properties/PropertiesTableCells.tsx`.
3. Page-level consumers under `src/pages/**` and remaining feature dialogs.
4. `src/hooks/{usePortfolioTimeline,usePortfolioRisks,useMissingInfo,useComplianceAutoSchedule}.ts` + their tests.
5. Delete `src/hooks/compat/usePropertyCompat.ts`, `src/hooks/usePropertiesCompat.ts`, and their `__tests__/` files. Drop the override block.

## Status (2026-06-09)

- ✅ V2-native list hook (`usePropertiesV2WithFinancials`) and singular
  hook (`usePropertyV2`) in place.
- ✅ Pure accessors in `src/lib/v2FieldAccessors.ts` with vitest coverage.
- ✅ ESLint guard installed; override list seeded with all current consumers.
- ✅ Migrated: `AddInsuranceDialog`, `CreateJobDialog`.
- ⏳ Remaining: 45 files (foundation libs, dashboard widgets, pages, hooks).
