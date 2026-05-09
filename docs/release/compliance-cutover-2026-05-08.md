# Compliance V1→V2 cutover — 2026-05-08

## Compliance §0b Ship A: kill double-writers — 2026-05-08

First ship of the §0b 6-prompt cutover series (A→F). Stops V1↔V2 drift from
growing further by removing every V1 write call site in the two known
double-writer files identified in #77's audit.

### Files touched

1. `src/hooks/useComplianceIntake.ts` — removed the V1 mirror block
   (`compliance_items` select + insert + update at lines ~358–391 in the
   pre-ship file). V2 writes to `compliance_documents_v2` are unchanged.
   Reads of V1 stay (Ship C will redirect via a compat layer).
2. `supabase/functions/process-document/index.ts` — removed the V1
   `compliance_items` upsert path, the V1 `compliance_documents` archive
   + version-bump + insert path, and the V1 `compliance` storage upload.
   Also dropped the now-orphan `complianceItemId` field from the
   `documents` row update and from the function's return shape (caller
   only inspects `success`). The unused `DEFAULT_REMINDER_DAYS` constant
   and the `ExistingComplianceItemRow` / `ComplianceDocumentVersionRow`
   row types went with them.

### Write call sites removed (count)

- `useComplianceIntake.ts`: **3** (`compliance_items` select + insert + update — strictly 2 writes; the select is a write-prerequisite read removed alongside).
- `process-document/index.ts`: **4** writes
  (`compliance_items.update`, `compliance_items.insert`,
  `compliance_documents.update`, `compliance_documents.insert`),
  plus 1 V1 storage upload to the `compliance` bucket and 1 V1
  read (`compliance_documents.select` for `version_number`) which only
  fed the removed insert.

After this ship, **zero V1 writes** to `compliance_items` or
`compliance_documents` originate from these two files.

### Test invariants added

- `src/hooks/__tests__/useComplianceIntake.test.ts` rewritten:
  asserts no `from('compliance_items').(insert|update|upsert|delete)`
  and no `from('compliance_documents').(insert|update|upsert|delete)`
  during intake, and that the V2 insert still fires.
- `supabase/functions/process-document/index.test.ts` (new): static
  source-text Deno test asserting the same two banned write patterns
  do not appear, and that the V2 insert pattern still does.
- `scripts/check-no-v1-table-refs.mjs` (CI guard) extended with a new
  write-pattern check on `compliance_items` and `compliance_documents`
  (insert/update/upsert/delete). Reads via `.select(...)` are still
  allowed.

### Allowlist note (heads-up for Ship C/D scope)

Enabling the new write-guard surfaced 4 additional V1-only writers that
weren't in Ship A's scope but will be in Ships C and D:

- **Ship C — UI hooks** (V1 read+write, redirect via compat layer)
  - `src/hooks/useCompliance.ts`
  - `src/hooks/useRenewalWorkflow.ts`
- **Ship D — background fns**
  - `supabase/functions/bulk-epc-enrich/index.ts`
  - `supabase/functions/send-compliance-reminders/index.ts`

These are listed in `WRITE_GUARD_ALLOWLIST` inside the CI script with
explicit ship-pointer comments. Each removal in C/D should also remove
its allowlist entry.

### Next ship

**Ship B — backfill V2 from V1.** Now that no new V1 writes can land,
copy any V1-only `compliance_items` / `compliance_documents` rows
(those without a matching `compliance_documents_v2` row) into V2 so
read-redirects in Ship C/D don't lose data. Disjoint id spaces (per
#77) mean the backfill will need property+type matching, not id joins.

### Verify

- `node scripts/check-no-v1-table-refs.mjs` → ✓
- `node scripts/check-edge-functions.mjs` → 71 entry files OK
- `npx vitest run src/hooks/__tests__/useComplianceIntake.test.ts src/__tests__/check-no-v1-table-refs.test.ts` → 5 passed
- `deno test --allow-read supabase/functions/process-document/index.test.ts` → 3 passed
