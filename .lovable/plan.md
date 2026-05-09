# Ship C dead-state audit — V1 fields with no V2 home

12 V1 fields surfaced by Ship C as missing from V2. Audited each for live writers/readers and V2 equivalents.

## Per-field verdict table

| # | V1 field | Writers (post-Ship-A) | UI readers (surfaced to user?) | V2 equivalent | Verdict |
|---|---|---|---|---|---|
| 1 | `responsible_party` | `AddComplianceItemDialog.tsx:97`, `ComplianceItemRow.tsx:74`, `bulk-epc-enrich:282`, `portfolio-chat/tool-executor:176` | YES — `ComplianceItemRow.tsx:174` `<span>• {item.responsible_party}</span>`; edited in row + add dialog | None. `compliance_tasks.assigned_to` (text) is per-task, not per-requirement | **LIVE** |
| 2 | `is_coho_required` | `AddComplianceItemDialog.tsx`, `useCompliance` updates | Form field only; not visibly rendered as label outside the form | None in `compliance_requirements_v2` | **AMBIGUOUS** (form-only — see STOP) |
| 3 | `is_manually_excluded` | `AddComplianceItemDialog.tsx`, `useComplianceDocumentExport:110`, `useReportGeneration:143` | Filtered on (export/report exclude excluded items) and surfaced in `send-weekly-compliance-email:438` | `compliance_requirements_v2.is_required=false` + `override_reason` covers this exact pattern | **DEAD** (V2 already replaces) |
| 4 | `renewal_status` | `useRenewalWorkflow` (`booked`/`confirmed`/`awaiting_verification`/`completed`), `QuickRenewalDialog:102`, `useComplianceAutoSchedule:161` | YES — auto-schedule reads it; renewal workflow drives UI step state | `compliance_tasks.status` lifecycle (`open`/`contractor_assigned`/`contractor_requested`/`awaiting_upload`/`completed`) — **richer model** | **DEAD** (V2 task pipeline replaces) |
| 5 | `renewal_contractor_id` | `useRenewalWorkflow:109`, `QuickRenewalDialog:103`, read by `useComplianceAutoSchedule:162` | YES (auto-schedule) | `compliance_tasks.contractor_id` (uuid) | **DEAD** |
| 6 | `renewal_booked_date` | `useRenewalWorkflow:110,146`, `useRenewalHistory` reads | Yes — renewal history list | `compliance_tasks.contractor_booked_date` (date) | **DEAD** |
| 7 | `renewal_notes` | `useRenewalWorkflow:111,147`, `QuickRenewalDialog:104` | Yes — renewal history | `compliance_tasks.description` / `resolution_notes` | **DEAD** |
| 8 | `auto_job_created` | None still writing post-Ship-A (was set by `create-compliance-jobs`/legacy auto pipeline) | Not surfaced in UI | Implied by existence of a `compliance_tasks` row with `task_type='renewal_due'` | **DEAD** |
| 9 | `auto_job_id` | None writing | `useCalendarEvents:87` reads as `relatedJobId` for calendar event link-out | `compliance_tasks.id` joined via `compliance_requirement_id`/`document_type`+`property_id` | **DEAD** (rewire calendar to V2 task) |
| 10 | `reminder_days` | `bulk-epc-enrich:284` (defaults `[90,60,30,0]`), `AddComplianceItemDialog:101`, also a USER-pref column on `notification_preferences` | Read by `send-compliance-reminders:245` from **user prefs**, not from item — V1 item-level `reminder_days` is unused on read path | None on requirements_v2; user pref already exists | **DEAD** at item level (lives on user prefs) |
| 11 | `reminder_count` | `send-compliance-reminders:315` (background fn) | Not surfaced in UI | `compliance_tasks.escalation_level` (integer, identical semantics) | **DEAD** (after rewiring reminder fn to V2) |
| 12 | `last_reminder_sent_at` | `send-compliance-reminders:314` | Not surfaced in UI | `compliance_tasks.last_escalated_at` | **DEAD** (after rewiring reminder fn to V2) |

**Tally: 1 LIVE · 10 DEAD · 1 AMBIGUOUS**

## STOP-and-ask — needs David's product judgment

**`is_coho_required`** (field #2). Set in `AddComplianceItemDialog`, written to V1, but I can't find a UI surface that *reads* it back to drive any visible behaviour (no badge, no filter, no Companies House annotation in the rendered row). Two readings:
- (a) intentional: data captured for future "filter by CoHo-required compliance" feature that never shipped → safe DEAD, drop the form field
- (b) bug: someone meant to render it (e.g. as a badge in `ComplianceItemRow`) and forgot → LIVE, must preserve in V2

Need David's call before I treat it as DEAD. If (a), no V2 schema change. If (b), it joins `responsible_party` in the C2 schema addition below.

## Ship C2 schema addition (LIVE fields only)

Just **`responsible_party`** (and `is_coho_required` if David rules (b)).

- Table: `public.compliance_requirements_v2` (per-property+per-doc-type, the right grain — matches V1 `compliance_items`)
- Column: `responsible_party text NULL` (V1 default `'Owner'`; keep nullable, default at the form layer not the DB so existing rows don't get a fake answer)
- Conditional column: `is_coho_required boolean NULL DEFAULT false`
- RLS: inherits existing org-scoped policies on `compliance_requirements_v2` — no new policy needed
- Backfill: copy from V1 `compliance_items` matching on `(property_id, compliance_type→document_type)` per Ship B's already-mapped enum table

## Ship C1 — DEAD-field deletions (call sites to remove)

`src/hooks/useCompliance.ts`:
- L37–39, L67–69, L106–108: drop the 9 dead columns from each `select()` (keep `is_required`, `notes`, `responsible_party`, plus base fields)
- After Ship C migrates these queries to compat layer, the `useUpdateComplianceItem` mutation only needs to accept the live subset

`src/hooks/useRenewalWorkflow.ts` — **delete entire file** post-rewire:
- L59–88 `useStartRenewal`: replace with `useStartRenewalTask` reading from `compliance_tasks`
- L90–125 `useBookContractor`: replace with `useUpdateTask({contractor_id, contractor_booked_date, status:'contractor_assigned'})` against `compliance_tasks`
- L127–161 `useConfirmAppointment`: same pattern, status `'contractor_requested'`
- L163–256 `useUploadRenewalCert`: keep doc upload (already V2-bound via Ship A), drop the V1 `compliance_items.update({renewal_status})` block at L240–247
- L258–317 `useCompleteRenewal`: drop V1 update at L271–280; the `compliance_tasks` auto-close at L284–305 already lives in V2 — keep it
- L319–350 `useRenewalHistory`: rewrite to read from `compliance_tasks` filtered by `task_type='renewal_due'` and `status='completed'`, ordered by `resolved_at`

`src/components/compliance/QuickRenewalDialog.tsx` L102–104: rewire to insert/update `compliance_tasks` row instead

`src/hooks/useCalendarEvents.ts` L33, L87: replace `auto_job_id` lookup with join on `compliance_tasks` via `(property_id, document_type)`

`src/hooks/useComplianceAutoSchedule.ts` L161–162: read `status` and `contractor_id` from `compliance_tasks` instead

`supabase/functions/send-compliance-reminders/index.ts`: rewire L29–30, L203, L235, L257, L314–315 to read/write `compliance_tasks.{escalation_level, last_escalated_at}` — keep allowlisted in CI guard until that's done

`supabase/functions/bulk-epc-enrich/index.ts` L282, L284: drop `responsible_party` and `reminder_days` from V1 insert (already in WRITE_GUARD_ALLOWLIST per Ship A — this clears it)

## Reshape Ship C

Originally: "compat layer for all 4 consumers". Verdicts say:

**New shape — Ship C1 + C2 + C3:**

1. **Ship C2 (schema first)** — single migration adds `compliance_requirements_v2.responsible_party` (+ `is_coho_required` pending David); backfill from V1 by `(property_id, type)`. Smallest possible schema change.
2. **Ship C1 (clean migrate consumers)** — rewire all 4 V1 readers + `QuickRenewalDialog` + `useCalendarEvents` + `useComplianceAutoSchedule` + `send-compliance-reminders` + `bulk-epc-enrich` to V2 directly. Delete `useRenewalWorkflow.ts` (replaced by thin wrappers around `useComplianceTasks` mutations). No compat layer needed — V2 has equivalents for every LIVE field after C2.
3. **Ship C3 (delete V1 type/form fields)** — drop the 9 dead columns from `ComplianceItem` type, drop `is_manually_excluded`/`reminder_days` from `AddComplianceItemDialog`, clear write-guard allowlist entries that are now actually dead.

The "thin V1→V2 compat layer" originally planned in §0b q2 is no longer needed — V2 has direct equivalents for every LIVE field once C2 ships. That's a simpler cutover than the audit anticipated.

## Pre-flight blockers for eventual V1 drop (Ship F)

- C1 must complete before V1 read paths to `compliance_items.renewal_*` fields can be removed
- `send-compliance-reminders` rewire is the longest tail — owns 5 of the 12 fields' write traffic
- `useCalendarEvents` rewire requires confirming `compliance_tasks` always has a row when a renewal is in flight (otherwise calendar loses its "scheduled job" link)

---

**Plan deliverable:** This audit. Awaiting David's call on field #2 (`is_coho_required` LIVE vs DEAD) before scoping the Ship C2 migration precisely.
