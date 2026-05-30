## Goal
Split `src/components/dashboard/DataQualityWidget.tsx` (690 lines) into a sibling folder. Pure mechanical extraction — no logic, data, state, props, or markup changes. Same public export, same import path, byte-identical rendered output.

## New folder
`src/components/dashboard/data-quality/`

## File-by-file moves

### 1. `data-quality/types.ts`
Moves from current lines 22–66 (verbatim):
- `DataQualityWidgetProps`
- `AffectedProperty`
- `ExemptedProperty`
- `QualityIssue`
- `QualityAnalysis`
- `PropertyWithExemptions`

Re-imports `PropertyWithFinancials` from `@/hooks/usePropertiesCompat`.

### 2. `data-quality/formatFieldName.ts`
Moves lines 68–85 verbatim: `formatFieldName(field: string): string`.

### 3. `data-quality/checkFieldExemption.ts`
Moves lines 87–115 verbatim: `checkFieldExemption(...)`. Imports `PropertyWithExemptions` from `./types`.

### 4. `data-quality/analyzeDataQuality.ts`
Moves lines 117–289 verbatim: `analyzeDataQuality(properties, companyMap)`. Imports `formatFieldName`, `checkFieldExemption`, and types from siblings.

### 5. `data-quality/statusColors.ts`
Extracts the two colour-helper pairs that currently appear inline in two places with **different** thresholds. To preserve byte-identical output, export both pairs as-is:
- `getRowStatusColor` / `getRowProgressColor` — thresholds 100 / 70 (currently `DataQualityIssueRow`, lines 310–320)
- `getOverallStatusColor` / `getOverallProgressColor` — thresholds 90 / 70 (currently orchestrator, lines 542–552)

### 6. `data-quality/DataQualityIssueRow.tsx`
Moves lines 291–492 verbatim: the entire `DataQualityIssueRow` component (header `CollapsibleTrigger`, progress bar, expanded missing-properties list, exempt list, all-complete fallback). Imports `QualityIssue` from `./types` and the row colour helpers from `./statusColors`.

### 7. `DataQualityWidget.tsx` (same path, rewritten as thin orchestrator)
Keeps:
- `export function DataQualityWidget({ properties }: DataQualityWidgetProps)` — **identical signature**.
- All hooks in the **same order**: `useState(expandedSections)`, `useState(lastUpdateTime)`, `useState(isRefreshing)`, `useCompanies()`, `useEffect` for `PROPERTY_UPDATED_EVENT`, `useMemo(companyMap)`, `useMemo(qualityAnalysis)`, `useCallback(handleRefresh)`, `toggleSection`.
- The full Card JSX (current lines 567–688): header with refresh button + percentage, overall progress bar + exempt count line, Needs Attention section, Other Categories section, fallback "show all" section, all-complete state, "View all properties" link.
- The unused `_completeCategories` local stays as-is (no behaviour change).

Imports from `./data-quality/*`: `analyzeDataQuality`, types, `getOverallStatusColor` / `getOverallProgressColor`, `DataQualityIssueRow`.

## Public API & import paths — unchanged
- File path stays `src/components/dashboard/DataQualityWidget.tsx`.
- Named export stays `DataQualityWidget` with the same props (`{ properties }`).
- Barrel re-export in `src/components/dashboard/index.ts` (`export { DataQualityWidget } from './DataQualityWidget'`) is untouched.
- All existing call sites continue to work without edits.

## What does NOT change
Props, hook order, query keys, event-listener wiring, `useMemo`/`useCallback` deps, sort order, thresholds, class names, copy, icons, rendered DOM, the unused `_completeCategories` local.

## Verify chain after approval
`bun run lint`, `bun run typecheck`, `bun run build`.
