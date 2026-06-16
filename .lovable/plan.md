# Refactor Oversized Modules

Goal: bring 7 files under ~300 lines each by extracting cohesive submodules. Pure structural refactor — no logic, no UI, no styling changes. All existing tests must continue to pass.

## Scope

| File | Lines | Split strategy |
|---|---|---|
| `src/lib/metricsConfig.ts` | 740 | Group metric definitions by domain into `metricsConfig/` (financial, compliance, occupancy, risk, portfolio, index.ts re-export). |
| `src/lib/calculations.ts` | 662 | Split by concern into `calculations/` (yield, dscr, tax, void, ltv, valuation, index.ts barrel). |
| `src/hooks/useBeneficialGroups.ts` | 643 | Extract DFS traversal + aggregation into `lib/beneficialGroups/{traverse,aggregate,types}.ts`; hook becomes thin orchestrator. |
| `src/pages/ComplianceV2.tsx` | 697 | Extract header, filter bar, matrix grid, drawer/details, empty state into `components/compliance-v2/*`. Page composes them. |
| `src/components/inbox/ComplianceReviewCard.tsx` | 693 | Extract header, metadata panel, document preview, action footer, decision dialog into `components/inbox/review-card/*`. |
| `src/components/ownership/LegalOwnershipEditor.tsx` | 676 | Extract owner row, add-owner form, validation hook, totals footer into `components/ownership/legal-editor/*`. |
| `src/components/distributions/DistributionWizard.tsx` | 645 | Extract per-step panels (amount, allocation, review, confirm) into `components/distributions/wizard/steps/*`; wizard keeps state machine. |

## Method (per file)

1. Read file in full; list logical sections.
2. Create sibling folder with extracted pieces; keep imports/exports identical from the public path.
3. Re-export from original path so consumers don't change.
4. Run typecheck + vitest after each file.
5. Verify no Playwright regressions on touched routes.

## Constraints

- No behaviour changes, no renamed props, no new abstractions beyond the split.
- Public import paths unchanged (`@/lib/metricsConfig`, `@/lib/calculations`, etc. continue to resolve via barrel/`index.ts`).
- No `any` introduced. Types move with their code.
- Skip a file if extraction would require touching behaviour to typecheck cleanly; report it instead of forcing.

## Verification

- `vitest run` green (excluding the pre-existing 45 unrelated `AuthProvider` harness failures already documented).
- `tsc --noEmit` clean.
- Manual: load Compliance v2 page, open a review card, open Legal Ownership editor, run Distribution wizard — visual diff zero.

## Out of scope

- Behaviour fixes, naming improvements, prop API changes, test additions, performance tweaks.
