## Problem
Two data views still show bare `Loader2` spinners during load instead of Skeleton layouts that approximate the loaded content.

## Investigation Summary

**AcquisitionAdvisor** — two confirmed bare spinners:
1. Past Analyses card (`s.loadingPast`) renders a centred `Loader2`.
2. Results panel (`s.runAnalysis.isPending`) renders a centred `Loader2` with text.

**ComplianceTasks** — the `ListState` wrapper already uses Skeleton rows (`h-16` bars) for the list area. However, `StatsRow` and `FiltersBar` render unconditionally and show zeros/empty state while data loads. There is no *additional* top-level `Loader2` spinner for the data view beyond the action spinner on the "Run Pipeline" button (which you asked to keep).

## Proposed Changes

### 1. AcquisitionAdvisor (`src/pages/AcquisitionAdvisor/index.tsx`)
Replace the two bare spinners with Skeleton layouts matching the loaded shape.

- **Past Analyses loading** (`s.loadingPast`): Replace the centred `Loader2` with 4 stacked skeleton rows (each approximating a `PastAnalysisRow`: a `Card` containing two short lines — address skeleton + metadata skeleton).
- **Analysis running** (`s.runAnalysis.isPending`): Replace the centred `Loader2` with a skeleton layout inside the right-hand `Card` that approximates `AnalysisResults`: a score/header skeleton at top, a grid of 4 metric-card skeletons, and 3 paragraph skeletons below.

### 2. ComplianceTasks (`src/pages/ComplianceTasks/index.tsx`)
No bare `Loader2` exists for the data load, but the stats/filter area looks empty/janky while the list skeletons appear. Proposed fix: when `s.isLoading`, render skeleton versions of `StatsRow` (4 `KpiCardSkeleton`s already in the common library) and `FiltersBar` (a single `Skeleton` bar with button placeholders) **above** the existing `ListState` skeleton rows. The `ListState` skeletons themselves are already correct and stay unchanged.

*If you intended a different ComplianceTasks spinner that I missed, stop me here and point me to it.*

## Files to edit
- `src/pages/AcquisitionAdvisor/index.tsx` — replace two `Loader2` blocks with inline Skeleton layouts.
- `src/pages/ComplianceTasks/index.tsx` — conditionally render skeleton stat/filter area during `isLoading`.

## No logic changes
Data fetching hooks, return shapes, query keys, and auth/form spinners remain untouched.

## Verify chain after
`bun run lint`, `bun run typecheck`, `bun run build`.