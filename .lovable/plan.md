## V1 compat layer retirement

Move all 47 call-sites off `usePropertyCompat` / `usePropertiesCompat`, delete the shims, and confirm the existing vitest + Playwright suites stay green.

### What the compat layer actually provides

`usePropertiesCompat` does three jobs:

1. Reads `properties_v2` and reshapes rows into the V1 `PropertyWithFinancials` shape (renames + derived fields).
2. Fetches `loan_facilities`, `property_annual_performance`, and `tenancy_agreements` in parallel, then stitches them into nested `loans` / `income` / `costs` / `tenancies` arrays.
3. Returns `null`/defaults for fields that have no V2 source (`bathrooms`, `epc_rating`, `is_hmo_licensed`, `conservation_area`, `legal_owner_*`).

Removing it means each consumer must either query V2 directly or accept those null fields explicitly.

### Plan

```text
Phase 1 — Build the V2-native equivalent (shared)
  • Create src/hooks/usePropertiesV2WithFinancials.ts
    – Same parallel fetch as the compat list hook, but returns native V2 shape:
      PropertyV2 & { loans: LoanFacility[]; performance: AnnualPerformanceRow | null;
                     tenancies: TenancyAgreementSlim[]; entity_name: string | null }
    – No renames, no V1-only null fields, no Proxy warning layer.
  • Create src/lib/v2FieldAccessors.ts with pure helpers that today live in the compat reshape:
      lifecycleType(p)         — 'core_rental' | 'development'
      formattedAddress(p)
      isGradeListed(p)
      hasGas(p)
      lastValuationDate(p) / lastValuationEstimate(p)
    Tests added alongside.
  • For property_passport-sourced fields (epc_rating, bathrooms, is_hmo_licensed,
    conservation_area, legal_owner_*): document mapping table in
    docs/release/v1-compat-retirement-2026-06-09.md and have each consumer that
    needs them switch to usePassportPageData / property_passport directly.

Phase 2 — Migrate library / pure-function consumers (no React)
  Files: src/lib/{metricsConfig,propertyMetrics,portfolioStats,portfolioInsights,
         csvExporter,bankPresentationGenerator}.ts + their .test.ts.
  • Change function signatures from `PropertyWithFinancials` to the new
    V2-native composite type.
  • Replace field reads: address_line → address_line_1, area_name/town_city
    → city, beds → total_lettable_rooms, has_gas → has_gas_supply,
    is_grade_listed → listing_grade !== 'none', lifecycle_type → derived via
    lifecycleType(), formatted_address → formattedAddress(), etc.
  • Update existing snapshots/fixtures in lib tests.
  • Run targeted vitest: bunx vitest run src/lib

Phase 3 — Migrate dashboard widgets and the data-quality module
  Files: ThisMonthWidget, PortfolioHealthWidget, LenderExposureChart,
         AreaExposureChart, ComplianceAlertsWidget, DashboardTabs,
         components/dashboard/data-quality/* (types, checkFieldExemption,
         analyzeDataQuality), components/maps/PropertyMap,
         components/properties/PropertiesTableCells.
  • Swap usePropertiesCompat → usePropertiesV2WithFinancials.
  • Update field reads via the accessors from Phase 1.
  • For data-quality "exemption" checks that read passport-only fields,
    extend the hook input to accept the passport map already available from
    usePassportPageData.

Phase 4 — Migrate page-level consumers and feature dialogs
  Files: pages/{Documents,Pipeline,Passport,DashboardMap,Insights,
         ImportPassport,Timeline}.tsx, pages/ComplianceCalendar/hooks/
         useComplianceCalendar.ts, components/compliance/{ComplianceCalendar
         Content, CalendarExportButton}, components/insurance/AddInsurance
         Dialog, components/jobs/CreateJobDialog, components/maintenance/
         CreateMaintenanceRequestDialog, components/insights/Ownership
         AttributionSection, components/property/StressTestPanel,
         components/reports/BankPresentationDialog, components/settings/
         ImportPassportsTab, components/documents/ValuationMasterDashboard.
  • Same swap pattern as Phase 3.
  • Dialogs that only need {id, address_line_1, postcode} switch to
    a lightweight selector built on usePropertiesV2 (no financial joins).

Phase 5 — Migrate the remaining hooks
  Files: src/hooks/{usePortfolioTimeline,usePortfolioRisks,useMissingInfo,
         useComplianceAutoSchedule}.ts + their tests.
  • usePortfolioRisks already has a vitest spec — update its fixtures to the
    new shape, keep the assertions identical (behaviour-preserving).

Phase 6 — Delete the compat layer
  • Delete src/hooks/compat/usePropertyCompat.ts
  • Delete src/hooks/compat/__tests__/usePropertyCompat.test.ts
  • Delete src/hooks/usePropertiesCompat.ts
  • Delete src/hooks/useProperties.ts re-exports if no longer referenced
    (verify with rg).
  • Add an ESLint no-restricted-imports rule so the paths cannot return.

Phase 7 — Verify
  • bun run typecheck
  • bun run test  (full vitest suite)
  • bun run lint
  • bunx playwright test e2e/smoke.spec.ts e2e/route-guards.spec.ts
    e2e/dashboard-interaction.spec.ts e2e/property-crud.spec.ts
  • Manually load /dashboard, /pipeline, /insights, /timeline,
    /compliance-calendar in preview to confirm no runtime regressions.
  • Update memory rule #4 (V2 Architecture) to drop the V1↔V2 "compat layer"
    qualifier.
```

### Technical notes

- **Behaviour preservation rule**: derived fields (`lifecycle_type`, `formatted_address`, `is_grade_listed`, `beds`, `has_gas`, `last_valuation_*`) are now produced by `v2FieldAccessors.ts` using exactly the same expressions the compat reshape used. Diffing the compat reshape against the accessors line-by-line is the simplest correctness check.
- **`__v2_entity_id` / `__v2_entity_name` consumers**: any file currently reading those underscore-prefixed escape hatches just stops needing them — the V2 shape exposes `entity_id` and the joined `entity_name` directly.
- **Loans mapper quirks** (`lender` populated from `lender_id`, `capital_or_interest` derived from `interest_only`, etc.) are preserved by keeping the same `mapLoanToV1` logic until callers no longer depend on the V1 loan shape. Phase 2/3 consumers that touch loans either keep using the mapped shape (helper retained as `loanFacilityToCard`) or migrate to native `loan_facilities` rows — decided per file.
- **`property_annual_performance` is a view, not a table** — the new hook keeps the existing single-row-per-property assumption; no new queries.
- **Test impact**: existing tests in `src/lib/*.test.ts`, `src/hooks/__tests__/usePortfolioRisks.test.ts`, and `src/hooks/compat/__tests__/usePropertyCompat.test.ts` need updates; the compat test is deleted in Phase 6.
- **Scope discipline**: no behaviour changes, no new features, no field additions in this PR. Pure refactor.

### Risk and sequencing

- Foundation libs (`propertyMetrics`, `portfolioStats`, `portfolioInsights`) feed nearly every dashboard widget. Phase 2 ships first and gets full test coverage before any widget/page is touched.
- Phases 3–5 are independent file groups and could in principle be reordered, but the listed order keeps `usePropertiesCompat` referenced until the last consumer is migrated, so the shim stays callable mid-migration and the app remains runnable between phases.
- Phase 6 (delete) is only safe after `rg "usePropertyCompat|usePropertiesCompat|compat/usePropertyCompat|PropertyCompatWithFinancials"` returns zero hits in `src/`.

### Out of scope

- Adding V2 sources for fields that genuinely don't exist in V2 (`bathrooms`, `epc_rating`, etc.). Those become explicit reads against `property_passport` per the existing memory note, or stay as `null` where the consumer already tolerated it.
- Touching the V1 `properties` table itself — the freeze triggers already cover that.
- The unrelated `supabaseAny` typed-client debt (separate effort).
