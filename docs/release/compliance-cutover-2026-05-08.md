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

## Compliance §0b safe-slice (C2 + 2 clean migrates) — single column add + view extension

Re-narrowed mid-flight after the dead-state audit (#80) was found to be only
partially correct: fields that have a V2 *schema* equivalent (e.g.
`renewal_status` → `compliance_tasks.status`) are not necessarily *dead from
the UI* — several still feed live UI surfaces via V1-only code paths
(`RenewalQueue`/`RenewalWorkflowDialog`, `QuickRenewalDialog`,
`useReportGeneration`, `useCalendarEvents.auto_job_id`,
`useComplianceAutoSchedule`, `send-weekly-compliance-email`). Reframing:
"dead from V2's perspective" ≠ "dead from UI's perspective". This ship
delivers only the part of C1/C2/C3 that is unambiguously safe; the rest moves
to a new **C1.5** ship.

### What shipped

1. **C2 — schema + view + backfill** (single migration)
   - `compliance_requirements_v2.responsible_party text NULL` added
     (idempotent: `ADD COLUMN IF NOT EXISTS`).
   - `compliance_matrix_v2` view extended to expose `responsible_party`
     (column appended at end — `CREATE OR REPLACE VIEW` rejected re-ordering
     under 42P16 on first attempt).
   - Backfill from V1 `compliance_items.responsible_party` matched by
     `(property_id, compliance_type → document_type)`. Pre-flight check on
     the source: 119 V1 rows with `responsible_party`, 119 distinct
     `(property, type)` pairs, **zero conflicts** — no "pick most recent"
     ambiguity. Post-flight: **117 rows backfilled**. Two V1 types
     (`Fire Suppression System Certificate`, `MCS Certificate`) have no V2
     `document_type` equivalent and were intentionally skipped — that's the
     expected 119→117 gap. Idempotency guard: `WHERE cr.responsible_party IS NULL`.
2. **C1-narrowest — 2 clean consumers redirected to V2 matrix view**
   - `src/hooks/useRRBReadiness.ts` — reads `document_type, expiry_date,
     is_required` from `compliance_matrix_v2` instead of
     `compliance_items.compliance_type`. Filters `is_required=false`
     (override) before scoring. `normaliseCertType()` in `src/lib/rrb/score.ts`
     accepts V2 enum slugs unchanged (substring match), so no scoring change.
   - `src/pages/tenant-portal/TenantCertificates.tsx` — reads from
     `compliance_matrix_v2` (single query — the view already joins the active
     `compliance_documents_v2` row, so the separate `compliance_documents`
     query is gone). Cert-type list & label keys updated to V2 enum slugs
     (`gas_safety_certificate`, `eicr`, `epc`, `hmo_licence`,
     `fire_risk_assessment`). RLS parity confirmed: V1 and V2 compliance
     tables share the same `user_has_org_access` +
     `user_has_shareholder_compliance_access` policy shape.

### What stayed put (no changes this ship)

- `useCompliance.ts` — still V1 reads + writes for all 12 fields including
  `responsible_party`. Stays in `WRITE_GUARD_ALLOWLIST`.
- `useRenewalWorkflow.ts` — untouched. Still in `WRITE_GUARD_ALLOWLIST`.
- `RenewalWorkflowDialog`, `QuickRenewalDialog`, `useComplianceAutoSchedule`,
  `useCalendarEvents`, `useReportGeneration`, `reportPdfGenerator`,
  `useComplianceDocumentExport`, `send-weekly-compliance-email` — all
  untouched (C1.5 territory).
- V1 `complianceTypes.ts` shape and `types.ts` V1 columns — untouched (C3
  territory).

### Deferred to C1.5 — V1 renewal/exclusion workflow rewire onto V2

Real schema-mapping work, not mechanical:

- **Renewal state machine** (`renewal_status`, `renewal_contractor_id`,
  `renewal_booked_date`, `renewal_notes`, `auto_job_created`, `auto_job_id`)
  → `compliance_tasks` (`status` enum, `contractor_id`, `contractor_booked_date`,
  `description`/`resolution_notes`, `id`). The V1 free-text `renewal_status`
  values must be mapped to the V2 enum. Touches: `useRenewalWorkflow`,
  `RenewalWorkflowDialog`, `QuickRenewalDialog`, `useComplianceAutoSchedule`,
  `useCalendarEvents`.
- **Manual exclusion** (`is_manually_excluded` + `exclusion_reason`) →
  `compliance_requirements_v2.is_required = false` + `override_reason`.
  Decision needed: whether `override_reason` becomes required-when-toggling
  off. Touches: `useReportGeneration`, `reportPdfGenerator`,
  `useComplianceDocumentExport`, `send-weekly-compliance-email`,
  `AddComplianceItemDialog`.
- **Reminder counters** (`reminder_count`, `last_reminder_sent_at`) →
  `compliance_tasks.escalation_level` + `last_escalated_at`. Touches:
  `send-compliance-reminders` (Ship D's territory — coordinate).
- **Five V1 compliance types with no V2 `document_type` home** —
  `Building Control Certificate`, `Fire Door Certification`,
  `Fire Panel Commissioning Certificate`, `Insurance Schedule`,
  `Floor Plans / Fire Plans`. C1.5 must either extend the V2 type set or
  surface the gap to the user.

C1.5 will rewire `useCompliance.ts` and `useRenewalWorkflow.ts` atomically
across all remaining fields (no per-field surgical extraction — the dual-source
drift risk on partial rewires is real).

### Deferred to C3 — V1 type cleanup

Cannot drop the 11 dead V1 columns from `src/integrations/supabase/types.ts`
or the `ComplianceItem` shape until C1.5 lands and removes all remaining V1
reads/writes. C3 will also drop the `useCompliance.ts` and
`useRenewalWorkflow.ts` entries from `WRITE_GUARD_ALLOWLIST`.

### Verify chain

- ✓ `node scripts/check-no-v1-table-refs.mjs` — clean (Ship A's
  `compliance_items`/`compliance_documents` write-pattern guard still passes
  with the same 4 allowlist entries; no new entries needed).
- ✓ `node scripts/check-edge-functions.mjs` — entry files OK.
- ✓ `node scripts/check-no-explicit-any-disables.mjs` — clean.
- ✓ `npx vitest run src/lib/rrb/__tests__/score.test.ts
  src/__tests__/check-no-v1-table-refs.test.ts
  src/hooks/__tests__/useComplianceIntake.test.ts` → 12 passed.
- ✓ Migration `cloud_status` healthy; backfill row-count confirmed (117).

### Post-ship state — V2 audit-log / source-of-truth note

`responsible_party` now lives on `compliance_requirements_v2` and is exposed
via `compliance_matrix_v2`. The 11 other "dead-from-V2" fields still live on
V1 `compliance_items` until C1.5 — the renewal/reminder/exclusion workflow
state is **not yet** entirely in V2's `compliance_tasks` system. The audit
memory (mem://architecture/audit-log-system-v2) covers the V2 tables; V1
audit coverage for these workflows is whatever already existed pre-cutover.
Confirm in C1.5 that `compliance_tasks` triggers cover the renewal lifecycle
events the UI cares about.

## Ship D — V1 `bulk-epc-enrich` removal

Confirmed dead-code via static grep + pg_cron + invocation logs:
- 0 callers in `src/` or `supabase/functions/` (only self-registration + lint allowlist + audit-doc rows)
- 0 `cron.job` rows matching `%bulk-epc-enrich%`
- 0 invocations returned by `edge_function_logs`

The V2 sibling `bulk-epc-enrich-v2` (driven by `useBulkEpcEnrichV2` →
`properties_v2` + `compliance_documents_v2`) fully replaces V1's scope.

Actions shipped:
- Deleted `supabase/functions/bulk-epc-enrich/` directory
- Deregistered the deployed function via `delete_edge_functions(['bulk-epc-enrich'])`
- Removed the V1 allowlist entry from `scripts/check-no-v1-table-refs.mjs`

No stub-and-observe phase needed; both static and runtime signals agreed on
DEAD. The `send-compliance-reminders` allowlist entry remains as the sole
Ship D follow-up.
