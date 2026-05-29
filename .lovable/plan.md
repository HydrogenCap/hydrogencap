## Goal

Split `src/hooks/useRentCollection.ts` (1,209 lines) into focused files, kept behind a barrel so all existing imports (`@/hooks/useRentCollection`) continue to work byte-identically. Pure mechanical extraction — no logic, signature, or return-shape changes.

## Approach

Convert `src/hooks/useRentCollection.ts` into a barrel that only re-exports. Move implementation into a new `src/hooks/rent-collection/` directory grouped by concern. Shared types and the `RENT_SCHEDULE_SELECT` constant, `getErrorMessage` helper, and `normalizeRentItem` go into shared modules consumed by the others.

All public symbols listed below remain exported from `@/hooks/useRentCollection` with identical names and signatures.

## Proposed file layout

```text
src/hooks/useRentCollection.ts                  (barrel: re-exports only)
src/hooks/rent-collection/
  types.ts                                      (shared types + constants)
  internal.ts                                   (private helpers)
  useRentSchedule.ts                            (core schedule queries + mutations)
  useArrears.ts                                 (arrears + summary analytics)
  useTenancyLedger.ts                           (ledger + on-time stats)
  useBulkActions.ts                             (bulk mutations)
  useScheduleGeneration.ts                      (generate-from-agreement)
  useRentTrend.ts                               (trend analytics)
```

## Exact move map

**`rent-collection/types.ts`** — pure types/interfaces (no runtime code other than the SQL constant):
- `RentStatus` (line 7)
- `RentScheduleItem` (9)
- `RentScheduleWithDetails` (29)
- `RentItemDisplay` (83)
- `RentPayment` (155)
- `RentScheduleNotesUpdate` (171) — currently not exported; keep non-exported but importable from this module
- `RENT_SCHEDULE_SELECT` (180) — internal constant, exported within the directory only
- `ArrearsAgingRow` (547)
- `MonthSummaryData` (637)
- `LedgerEntry` (676)
- `RentTrendPoint` (1163)

Public re-exports preserved through barrel: `RentStatus`, `RentScheduleItem`, `RentScheduleWithDetails`, `RentItemDisplay`, `RentPayment`, `ArrearsAgingRow`, `MonthSummaryData`, `LedgerEntry`, `RentTrendPoint`.

**`rent-collection/internal.ts`**:
- `getErrorMessage` (176)
- `normalizeRentItem` (97) — re-exported by barrel (currently public)

**`rent-collection/useRentSchedule.ts`**:
- `useRentSchedule` (201)
- `useRentScheduleItem` (326)
- `useUpdateRentScheduleStatus` (342)
- `usePaymentReminders` (379)
- `useSendReminder` (395)
- `useDeleteRentSchedule` (422)
- `useDuplicateRentSchedule` (439)
- `useUpdateRentScheduleNotes` (481)

**`rent-collection/useArrears.ts`**:
- `useRentSummary` (520)
- `useArrearsAging` (569)
- `useMonthSummary` (645)

**`rent-collection/useTenancyLedger.ts`**:
- `useTenancyLedger` (689)
- `usePaidOnTimeStats` (1005)

**`rent-collection/useBulkActions.ts`**:
- `useBulkMarkPaid` (788)
- `useBulkWriteOff` (869)
- `useBulkAddNote` (899)
- `useBulkSendReminder` (945)

**`rent-collection/useScheduleGeneration.ts`**:
- `useGenerateScheduleFromAgreement` (1063)

**`rent-collection/useRentTrend.ts`**:
- `useRentTrend` (1171)

## Barrel (`src/hooks/useRentCollection.ts` after refactor)

Contains only `export * from './rent-collection/<each file>';` (or named re-exports). All currently public symbols (types + hooks + `normalizeRentItem`) re-exported under the same names. Import path `@/hooks/useRentCollection` unchanged for all 30+ call sites.

## Invariants

- No function bodies modified; only cut/paste plus the imports each new file needs (`useQuery`/`useMutation`/`useQueryClient`, `supabase`/`supabaseAny`, `getUserOrgId`/`useUserOrg`, `logError`, `toast`, shared types/helpers).
- Public API byte-identical: same export names, same signatures, same return shapes, same query keys, same toast messages.
- No behaviour change, no renames, no reordering of effects.

## Verify chain after edit

1. `rg -n "from ['\"]@/hooks/useRentCollection" src | wc -l` before/after — count unchanged.
2. `bun run lint`
3. `bun run typecheck`
4. `bun run build`
