## Compliance_items §0b audit — 2026-05-10

**STOP-and-ask triggered (condition a):** there is **no `compliance_items_v2`**. V1 `compliance_items` is split across **three** V2 tables (`compliance_requirements` + `compliance_documents_v2` + `compliance_tasks`). This is materially different from rooms/properties/share_classes/tenants (which had clean 1:1 V2 siblings). The §0b ship sequence as defined assumes a 1:1 redirect — that template does not apply here. Surfacing the full audit + the product Qs that block any ship.

---

### 1) Schema parity — three-way split, no 1:1 sibling

V1 `compliance_items` (24 cols) blends three concerns:

| V1 concern | V2 home |
|---|---|
| **Rule** ("HMO licence is required for this property, review every 12mo, lead time 60d") — `compliance_type`, `is_required`, `is_manually_excluded`, `exclusion_reason`, `responsible_party`, `is_coho_required`, `reminder_days` | **`compliance_requirements`** (15 cols) — `document_type`, `is_required`, `requirement_reason`, `override_reason`, `review_frequency_months`, `lead_time_days`, `responsible_party`, `room_id` |
| **Evidence** ("the actual cert: file, dates, issuer") — `issue_date`, `expiry_date`, plus joined `compliance_documents` row for `file_url`/`file_name` | **`compliance_documents_v2`** (own cols incl. `issue_date`, `expiry_date`, `file_url`, `file_name`, `file_hash`, `is_current`, `supersedes_id`, `cost`, `contractor_id`, `ai_*`, `status`) |
| **Workflow** ("renewal booked, reminders sent, auto-job created") — `renewal_status`, `renewal_booked_date`, `renewal_contractor_id`, `renewal_notes`, `last_reminder_sent_at`, `reminder_count`, `auto_job_created`, `auto_job_id` | **`compliance_tasks`** (own cols incl. `task_type`, `priority`, `status`, `due_date`, `escalation_level`, `last_escalated_at`, `contractor_id`, `compliance_requirement_id` FK, `compliance_document_id` FK) |

**Key gap:** V1 columns with no clean V2 home — `is_coho_required`, `reminder_days[]` (V1 array vs V2's per-task `escalation_level`), `renewal_*` (workflow state outside the task lifecycle), `auto_job_id` (FK to legacy jobs). These need a product call.

**Display-name mismatch:** V1 stores `compliance_type` as user-visible labels (`'Gas Safety Certificate (CP12)'`); V2 stores `document_type` as enum values (`'gas_safety_certificate'`). The DB function `migrate_compliance_to_v2(p_org_id)` already encodes a 20-branch CASE-mapping for this — i.e. the team already accepted that V1→V2 is lossy/derived rather than a 1:1 column rename.

### 2) Row counts + drift

| Table | Rows |
|---|---|
| `compliance_items` (V1) | **119** |
| `compliance_requirements` (V2 rule) | **346** |
| `compliance_documents_v2` (V2 evidence) | **224** |
| `compliance_tasks` (V2 workflow) | **124** |
| `compliance_documents` (V1 evidence sibling) | 117 |

346/224 > 119 → V2 is no longer derived from V1; it has independently grown. Drift is **expected and large** because `compliance_requirements` is auto-generated per-property by V2 triggers (per memory `v2-automation-triggers`). Spot-check skipped (V1 column names differ from what I guessed — `compliance_type` not `document_type`; not material to the ship decision since the audit is structural not data-quality).

### 3) V1 writers (writes to `from('compliance_items')`)

Frontend hooks:
- `src/hooks/useCompliance.ts` — **6 sites** (L34, L64, L103, L156, L181, L241): list/create/update/delete legacy items. Live consumer chain TBD per Q1.
- `src/hooks/useRenewalWorkflow.ts` — **6 sites** (L66, L106, L143, L241, L272, L326): renewal-state mutations. Live consumer TBD per Q1.

Edge functions:
- `supabase/functions/send-weekly-compliance-email/index.ts:435` — read-only select for digest email
- `supabase/functions/send-compliance-reminders/index.ts:200, 312` — reads + writes `last_reminder_sent_at`/`reminder_count`
- `supabase/functions/send-tenant-certificates/index.ts:114` — read for tenant portal cert listing
- `supabase/functions/portfolio-chat/tool-executor.ts:161, 473, 548, 651` — AI assistant reads
- `supabase/functions/analyse-acquisition/index.ts:118` — read

DB-side: function `migrate_compliance_to_v2` reads V1, writes V2 (one-way, idempotent — safe).

**Classification: all V1-shape → V1.** No mixed-mode (V2-shape → V1) writers found. No hybrid third-shape. So **Ship A would be `skip`** (nothing to kill; the bleeding is already absent).

### 4) V1 readers — same files; classification gated on Q1

All sites above are reads or read+write. Liveness depends on whether the V1 surfaces (`useCompliance` consumers, `useRenewalWorkflow` consumers, the 4 edge functions) have been parallel-rebuilt on V2 yet. Per memory `portfolio-compliance-register-v12`, the **register page** already runs on `compliance_matrix_v2`. But `send-compliance-reminders` and `send-tenant-certificates` are still V1-only. So readers are **mixed live + suspected-dead** — needs Q1 decision.

### 5) Double-writers

`rg compliance_requirements|compliance_documents_v2 src/hooks/useCompliance.ts src/hooks/useRenewalWorkflow.ts` → **0 hits.** No file double-writes V1+V2 in the same function.

### 6) FKs — heavy

FKs **TO `compliance_items`**: `compliance_documents.compliance_item_id`, `compliance_notifications.compliance_item_id`, `compliance_jobs.compliance_item_id` (per migration files), and `auto_job_id` self-ref via `compliance_items.auto_job_id → compliance_jobs.id`. All are V1↔V1 — no cross-V1/V2 FK drift detected (V2 tables FK to `properties_v2`/`compliance_requirements`, not back to V1).

### 7) RLS policies — generic, V2-compatible

5 policies, all `user_has_org_access(org_id)` / `user_has_shareholder_compliance_access(org_id)`. **None are V1-specific** — same shape as policies on V2 tables. No RLS work needed for the eventual freeze/drop.

### 8) Background fns / triggers / views

Triggers ON `compliance_items` (4):
- `audit_compliance_delete_trigger` BEFORE DELETE → `audit_compliance_delete()`
- `compliance_item_reminder_trigger` AFTER INSERT/UPDATE OF expiry_date → `trigger_schedule_compliance_reminders()`
- `compliance_renewal_trigger` BEFORE UPDATE → `reset_compliance_job_on_renewal()`
- `update_compliance_items_updated_at` BEFORE UPDATE → standard

DB functions referencing `compliance_items` (8 procs, dedup'd): `trigger_generate_tenancy_compliance`, `update_job_priorities`, `migrate_compliance_to_v2`, `cancel_renewed_compliance_jobs`, `create_jobs_for_expiring_compliance` — these wire V1 into the **legacy job pipeline** (`compliance_jobs`).

Views referencing `compliance_items`: **`rrb_readiness_v`** (1) — single live view used by `useRRBReadiness.ts`.

### 9) Freeze-trigger install state — VERIFIED ABSENT

Direct `pg_trigger` query on `public.compliance_items`: **no `v1_freeze%` trigger present.** Confirms #87/#99's "PENDING-3-of-6" tally for compliance_items. No memory drift.

### 10) Audit-log coverage

`audit_compliance_delete_trigger` writes deletes to a legacy V1-specific audit path (per `audit_compliance_delete()`). It is **not** wired into the generic 13-table V2 JSONB audit system (per memory `audit-log-system-v2`). So coverage is partial/legacy-only.

### 11) Recommended ship order

| Ship | Action | Size | Status |
|---|---|---|---|
| A | Kill V2-shape→V1 writers | **skip** | None exist |
| B | Backfill V1→V2 | **medium**, **blocked on Q2** | `migrate_compliance_to_v2` exists but is per-org and lossy; need to decide whether to run for all orgs and what to do with V1's renewal_*/auto_job/reminder workflow data that has no V2 home |
| C | Redirect readers | **large**, **blocked on Q1** | 12+ frontend sites, 5 edge functions, 1 view (`rrb_readiness_v`) — but each redirect requires a per-feature decision because the read shape changes from "one row per item" to "join requirements + documents_v2 + tasks" |
| D | Migrate background fns/triggers | **large**, **blocked on Q3** | 4 triggers + ~5 procs wire V1 into the legacy `compliance_jobs` pipeline; `compliance_jobs` itself is a V1 table that may also need its own §0b |
| E | Install `v1_freeze_guard` | **small**, **blocked on D** | Pure mechanical add once D lands; would crash all 4 triggers + reminder/job procs if installed today |
| F | DROP `public.compliance_items` | **medium**, **blocked on B+C+D+E** | Plus drop 4 triggers, ~5 procs, `rrb_readiness_v`, FK chain to compliance_documents/notifications/jobs |

### 12) Open product Qs (block all ships)

**Q1 — Reader liveness audit.** Is `useCompliance` / `useRenewalWorkflow` / `send-compliance-reminders` / `send-tenant-certificates` / `analyse-acquisition` / `portfolio-chat` still in the live UX surface, or have they been parallel-rebuilt on `compliance_matrix_v2` + `compliance_tasks`? I can grep import-graphs but the call is ultimately product (which UI flows do you intend to keep on V1 indefinitely vs migrate)?

**Q2 — V1-only column fate.** What happens to V1 columns with no V2 home in Ship B's backfill?
- `is_coho_required` → drop, or add to `compliance_requirements`?
- `reminder_days[]` (per-item array) → drop in favour of V2's per-task `escalation_level`, or preserve via mapping?
- `renewal_status`, `renewal_booked_date`, `renewal_contractor_id`, `renewal_notes` → reify as `compliance_tasks` with `task_type='renewal'`? Or drop (and accept loss of in-flight renewal state)?
- `last_reminder_sent_at`, `reminder_count`, `auto_job_created`, `auto_job_id` → tied to legacy `compliance_jobs` table, which is itself V1; depends on Q3.

**Q3 — Legacy job pipeline.** `compliance_jobs` + the 4 triggers + ~5 procs (`create_jobs_for_expiring_compliance`, `cancel_renewed_compliance_jobs`, `update_job_priorities`, `reset_compliance_job_on_renewal`, `trigger_schedule_compliance_reminders`) are an entire V1 subsystem that compliance_items writes into. Are they still in production use, or has `compliance_tasks` (with its own escalation/priority) replaced them? If the latter, this becomes its own §0b for `compliance_jobs`, sequenced **before** compliance_items Ship D. If the former, compliance_items is permanently dual-resident.

**Q4 — `rrb_readiness_v` view.** Used by `useRRBReadiness.ts`. Should this be rewritten on V2 sources, or is RRB readiness scoring intentionally pinned to V1's `compliance_type` text labels?

**Q5 — Migration function execution.** `migrate_compliance_to_v2(p_org_id)` exists and is idempotent (skips dupes by `property_id+document_type+issue_date`). Has it been run for each org? V2 has 224 docs vs V1 119 — likely yes for most orgs, but unverified.

---

### Recommendation

**Don't define Ship A/B/C/D/E/F yet.** This table doesn't fit the §0b 1:1-redirect template. Recommended next step is a **product call answering Q1–Q5**, then one of two paths:

1. **"V1 stays indefinitely"** — install `v1_freeze_guard` is impossible because reminder/job procs write to it; instead, formally document compliance_items as a permanent dual-resident with V2 derived from it, and close §0b for this table as **out-of-scope**.

2. **"V1 sunsets"** — break into a multi-table §0b: first a `compliance_jobs` audit (Q3), then per-feature reader migrations (Q1) with explicit V1-column-fate decisions (Q2), then compliance_items Ship D/E/F.

Either way, no code changes today — this is a product/scope decision, not an engineering ship.