# Vitest Failure Triage — 2026-04-26

## Summary

- **Total failing tests:** 32
- **Pre-existing on main:** 0
- **Session-introduced:** 32
  - **#6 ListState wrapper:** 1
  - **#8 DensityToggle:** 31
  - #7 ActivationWidget: 0
  - #21 wave-2: 0
  - RLS: 0
  - Other: 0

Baseline commit (immediately before today's session): `c5f2571` — "Claude/testing plan improvements" (last commit before `975cb6f` "Added ListState wrapper").

## Root causes

### A. `useAuth must be used within an AuthProvider` (31 tests)

Files affected: `src/pages/JobsAndWorks.tsx`, `src/pages/RentCollection.tsx`, `src/pages/Reports.tsx`.

Prompt #8 added `<DensityToggle />` to each page header. `DensityToggle` calls `useDensity()`/`useSetDensity()` from `src/hooks/useAppSettings.ts`, which calls `useUserOrg()`, which calls `useAuth()`. The existing test suites for these three pages mock the page's data hooks but render the page outside an `AuthProvider` because, before today, the page never reached `useAuth`. Mounting `DensityToggle` introduced a new transitive dependency on `AuthContext` that the tests do not satisfy.

Test files themselves are unchanged since the baseline commit (`git log c5f2571..HEAD -- src/pages/__tests__/{JobsAndWorks,RentCollection,Reports}.test.tsx` returns nothing). The page source files were each modified exactly once in this session, by commit `e8184e6` "Added density toggle system".

### B. `Unable to find … "Load Demo Data"` (1 test)

File affected: `src/pages/PropertiesV2.tsx`.

Prompt #6 refactored the page's empty-state branch to use `<ListState>`, whose `emptyAction` API only accepts a single primary action. The previous inline `EmptyState` had both a primary `Add Property` action and a `secondaryAction={{ label: 'Load Demo Data', … }}`. The "Load Demo Data" button is no longer rendered. The test in `src/pages/__tests__/PropertiesV2.test.tsx:119` still asserts its presence.

## Numbered failure list

| # | Test | Classification | One-line cause |
|---|------|----------------|----------------|
| 1 | JobsAndWorks › renders the page heading and description | SESSION-INTRODUCED-BY-#8-DensityToggle | DensityToggle → useUserOrg → useAuth, no AuthProvider in test |
| 2 | JobsAndWorks › renders all 3 tab triggers | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 3 | JobsAndWorks › defaults to the Jobs tab | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 4 | JobsAndWorks › shows the active-jobs count badge excluding drafts | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 5 | JobsAndWorks › hides the Jobs badge when activeJobCount is zero | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 6 | JobsAndWorks › shows open-maintenance count on the Maintenance tab | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 7 | JobsAndWorks › hides the Maintenance badge when no open items | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 8 | JobsAndWorks › shows work-order count on the Work Orders tab | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 9 | JobsAndWorks › hides the Work Orders badge when zero | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 10 | JobsAndWorks › switches to the Maintenance tab | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 11 | JobsAndWorks › switches to the Work Orders tab | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 12 | JobsAndWorks › forwards activeJobsData to the SLA tracker sidebar | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 13 | JobsAndWorks › handles missing job/maintenance/WO counts without crashing | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 14 | PropertiesV2 › shows the empty-first-property state when there are no properties | SESSION-INTRODUCED-BY-#6-ListState | ListState refactor dropped the secondaryAction "Load Demo Data" button |
| 15 | RentCollection › renders the page title and description | SESSION-INTRODUCED-BY-#8-DensityToggle | same auth/provider chain as JobsAndWorks |
| 16 | RentCollection › defaults to the rent-roll tab and passes current month | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 17 | RentCollection › does not show Export Rent Roll button when no schedule | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 18 | RentCollection › shows Export Rent Roll button and calls exporter | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 19 | RentCollection › opens the bank import dialog | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 20 | RentCollection › navigates to /rent/reconciliation on Reconciliation click | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 21 | RentCollection › switches to the Arrears tab | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 22 | RentCollection › switches to the Calendar tab | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 23 | RentCollection › switches to the History tab | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 24 | Reports › renders the header and description | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 25 | Reports › renders Generate Reports and Report History tabs | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 26 | Reports › renders one card per template from REPORT_TEMPLATES | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 27 | Reports › shows Lender-Grade badge on mortgage broker pack template | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 28 | Reports › shows the filtered-properties summary (plural) | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 29 | Reports › shows "1 property" when exactly one matches | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 30 | Reports › disables generate buttons when no properties | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 31 | Reports › calls generateReport mutate for non-broker templates | SESSION-INTRODUCED-BY-#8-DensityToggle | same |
| 32 | Reports › renders the Report History tab without crashing | SESSION-INTRODUCED-BY-#8-DensityToggle | same |

## Evidence

- `git log c5f2571..HEAD -- src/pages/JobsAndWorks.tsx src/pages/RentCollection.tsx src/pages/Reports.tsx` → each modified exactly once (commit `e8184e6` "Added density toggle system").
- `git log c5f2571..HEAD -- src/pages/__tests__/{JobsAndWorks,RentCollection,Reports,PropertiesV2}.test.tsx` → no changes; test expectations are stable.
- `git log c5f2571..HEAD -- src/pages/PropertiesV2.tsx` → 3 commits, all in the ListState wave (#6).
- `useAppSettings.ts` is new in this session (commit `e8184e6`); confirms the auth-chain dependency did not exist at baseline.

## Recommendation

All 32 failures were introduced by today's session. See chat reply for the recommended follow-up prompt.
