# Backfill compliance from Document Vault → /compliance-v2

## Why "132 need attention"

`compliance_matrix_v2` currently shows: **123 missing**, 9 expired, 9 expiring, 4 critical, 85 valid, 113 not_required. The "needs attention" filter on `/compliance-v2` is dominated by the 123 **missing** rows.

Meanwhile, in `public.documents` we already have **157 documents that are fully classified, linked to a V2 property, AND of a compliance type**, but **0 of them exist in `compliance_documents_v2`**. They were uploaded via the Vault, processed by `process-document-v2`, but that edge function **only updates `documents`** — it never inserts into `compliance_documents_v2`. (Only `process-document` (v1) and `useBulkDocScanner` write to v2; the Vault uploader doesn't call either.) That's the gap.

Breakdown of the 157 ready-to-file:
- building_insurance: 25, gas_safety: 23, electrical: 23, fire_alarm: 21
- emergency_lighting: 17, epc: 16, hmo_licence: 12, pat_testing: 9
- fire_risk_assessment: 8, fire_suppression: 1, asbestos: 1, legionella: 1

Plus 10 docs with only `ai_suggested_property_id` (confidence < 0.90 promotion threshold) and 59 with `extraction_status='failed'`.

## Plan — three steps, idempotent

### Step 1 — One-shot SQL backfill migration (the big win)

Insert into `compliance_documents_v2` from every `documents` row where:
- `property_id IS NOT NULL`
- `ai_suggested_doc_type` is one of the compliance types
- no existing `compliance_documents_v2` row already references the same `file_url`

For each backfilled row:
- `document_type` = `ai_suggested_doc_type`
- `issue_date` = `extracted_issue_date` (fallback: `created_at::date`)
- `expiry_date` = `documents.expiry_date`
- `certificate_number` = `extracted_reference_number`
- `issuer_name` = `extracted_certifier_company` ?? `extracted_certifier_name`
- `file_url`, `file_name` from documents
- `ai_extracted = true`, `ai_confidence_score = ai_doc_type_confidence`
- `is_current = true`
- `status` computed from expiry_date: expired / critical (<30d) / expiring_soon (<90d) / valid

Same idempotency guard the bulk scanner uses (file_url match). Re-running is a no-op.

Expected effect: ~157 new compliance docs, dropping "missing" from 123 → ~30–50 (some compliance types may have no matching upload).

### Step 2 — Promote the 10 high-suggestion orphans

For documents where `property_id IS NULL` AND `ai_suggested_property_id IS NOT NULL` AND `ai_property_confidence >= 0.80`, promote `ai_suggested_property_id` → `property_id`. Then they get picked up by Step 1's same migration (run as a single transaction). Anything below 0.80 is left for manual review in the Vault.

### Step 3 — Re-queue 59 `failed` extractions (optional, gated)

Re-trigger `process-document-v2` only for `extraction_status = 'failed'` docs uploaded > 24h ago. We do this via a small one-shot edge function (`reprocess-vault-documents`) that:
- Fetches failed docs scoped to the caller's org (RLS via auth header)
- Generates a fresh signed URL for each
- Calls the existing `process-document-v2` per doc, with concurrency 3, total cap 100 per invocation
- Returns a summary `{ requeued, succeeded, failed }`

Triggered manually from a small button on `/compliance-v2` (header: "Rescan failed Vault documents (59)"). No automatic cron — David presses it.

## Technical notes

- **No schema change**, no edge function rewrite — `process-document-v2` already does the right thing for *new* uploads after the previous fix. This patch closes the historical gap.
- **Backfill is a SQL migration**, not a script — runs once at deploy, idempotent on re-run via `WHERE NOT EXISTS` join on `file_url`.
- **Auto-compliance-pipeline** then takes over: it reads `compliance_documents_v2`, generates renewal tasks, etc. So filing these 157 also kicks off the downstream automation correctly.
- Files touched:
  - `supabase/migrations/<ts>_backfill_compliance_v2_from_documents.sql` (Steps 1+2 in one txn)
  - `supabase/functions/reprocess-vault-documents/index.ts` (Step 3)
  - `src/pages/ComplianceV2.tsx` — add a small "Rescan failed Vault documents" button in the header that invokes the new function and toasts the result
- No changes to `documents`, `compliance_documents_v2`, or `process-document-v2` schemas/logic.

## Acceptance

- After migration: `SELECT count(*) FROM compliance_documents_v2` rises by ~150–160; `compliance_matrix_v2` "missing" drops to ≤ ~50.
- `/compliance-v2` "Needs Attention" count drops from 132 → ~30–60.
- Button on `/compliance-v2` reprocesses the 59 failed docs and surfaces them in the Vault for review (no silent auto-link below 0.90 confidence — existing promotion threshold preserved).
- Re-running the migration is a no-op.
