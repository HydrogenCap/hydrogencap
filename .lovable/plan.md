# Tenants §0b cutover — audit + STOP-and-ask

## Step 1 — Data characterisation

| | V1 `tenants` | V2 `tenants_v2` |
|---|---|---|
| Row count | 3 | 3 |
| Shared ids | 0 | — |
| V1-only ids | **3** | — |
| V2-only ids | — | **3** |
| All `status='active'` | ✓ | ✓ |

**V1 rows (live, company-type):**
1. `Property Team / Clearsprings Ready Homes Ltd` (tenant_type=`company`)
2. `Property Team / Serco Limited` (tenant_type=`company`)
3. `Mike Molton / Oxford Brookes Enterprises Limited` (tenant_type=`company`)

**V2 rows (look like duplicate re-entries):**
1. `Property Team` (tenant_type=`private`, no company link)
2. `Property Team` (tenant_type=`private`, no company link)
3. `Mike Molton` (tenant_type=`private`, no company link)

**Same human/contact names, different ids, company linkage stripped.** V2 was populated as private individuals rather than carrying through the company-tenant identity from V1. None of the V2 rows preserves `company_name`, `company_number`, `compliance_contact_*`, `vat_*`, etc.

V1 has **14 rows in `public.documents` linked via `documents.tenant_id` FK** — those documents currently anchor to the V1 company-tenant ids, not the V2 ids.

## Step 2 — Schema mapping (apples ≠ oranges)

V1 has 41 columns; V2 has 16. The diff is structural, not cosmetic.

| Column family | V1 has | V2 has | Verdict |
|---|---|---|---|
| Identity (id, org_id, name, email, phone, dob, NI, status, tenant_type, notes) | ✓ | ✓ | **Compatible** |
| Emergency contact (3 fields) | ✓ | ✓ | **Compatible** |
| Employment (3 fields: status, employer name/address, annual_income) | ✓ | ✗ | **Missing in V2** |
| Guarantor (4 fields) | ✓ | ✗ | **Missing in V2** |
| Previous landlord references (4 fields) | ✓ | ✗ | **Missing in V2** |
| Portal (`portal_user_id`) | ✓ | ✗ | **Missing in V2** |
| Company tenant (10 fields: company_name, company_number, registered address, contact name/email/phone/role, trading_name, vat_registered, vat_number) | ✓ | ✗ | **Missing in V2** — but currently in use on all 3 V1 rows |
| Compliance contact (compliance_contact_name, compliance_contact_email) | ✓ | ✗ | **Missing in V2** — read by `send-tenant-certificates` |
| Referral source | ✗ | ✓ | V2-only addition |

LIVE/DEAD assessment of the V1-only columns (per the §0b dead-state pattern):
- **Company block (10 fields)**: **LIVE** — all 3 V1 rows populate `tenant_type='company'` + `company_name`. `send-tenant-certificates/index.ts:84` reads `company_name`, `company_contact_email`, `compliance_contact_name`, `compliance_contact_email`. Cannot be backfilled into V2 without schema extension.
- **Compliance contact pair**: **LIVE** — read by `send-tenant-certificates`.
- **Portal (`portal_user_id`)**: needs a follow-up grep before we can call it dead — tenant-portal RLS in #73 used `tenant_portal_access`, but if anything still resolves a tenant from the auth user via this column it's live. (Not blocking the audit; flag for Ship B verification.)
- **Employment / guarantor / previous-landlord (11 fields)**: most likely **DEAD-from-UI** in current build (not surfaced in any V2 wizard step), but worth a one-pass UI grep before dropping — same pattern as compliance §0b's "is_coho_required" sweep.

## Step 3 — Current writers/readers (post safe-slice)

`from('tenants')` (excluding `v1Frozen.ts`) — **3 sites, all read-only lookups**:

| File:Line | Shape | Fields read | Notes |
|---|---|---|---|
| `supabase/functions/send-tenant-certificates/index.ts:84` | read | id, org_id, first_name, last_name, email, **company_name, tenant_type, company_contact_email, compliance_contact_name, compliance_contact_email** | Reads V1-only company columns; cannot point at V2 today |
| `src/hooks/useBatchRenameDocuments.ts:115` | read | id, first_name, last_name | Pure-name lookup — safe to migrate once doc FK question is answered |
| `src/hooks/useDocumentManagement.ts:277` | read | first_name, last_name | Same — safe to migrate |

**No writers found in `src/` or `supabase/functions/`** outside `v1Frozen.ts`. Consistent with the live `v1_freeze_guard` trigger on `public.tenants` (see Step 4) — V1 is already frozen.

`from('tenants_v2')` — 13 references across 6 files (`useTenantsV2`, `useTenantLifecycle`, `useMigration`, `useActivationChecklist`, `seedDemoData`, `template-merge`). V2 is the active write path.

No mixed-mode files (the smoking-gun pattern from #77) found.

## Step 4 — pg_depend on `public.tenants`

Real dependents:
- **FK**: `documents.tenant_id → tenants.id` (constraint `documents_tenant_id_fkey`) — 14 live rows depend on it.
- **RLS policies**: `Org members manage tenants`, `Tenants view own profile`.
- **Triggers**: `audit_tenant_delete_trigger`, `trg_validate_tenant_type`, `update_tenants_updated_at`, **`v1_freeze_guard`** (already enabled — V1 writes already blocked).
- Indexes: `idx_tenants_org_id`, `idx_tenants_status`.

No SECURITY DEFINER functions or RLS policies reference `public.tenants`'s row type from outside the table itself. No #71-style cross-table function dependency.

## Step 5 — STOP-and-ask (required by the prompt)

The prompt says STOP-and-ask if (a) V1 has data V2 doesn't and the schema isn't compatible, or (b) the V1 rows are live tenants we can't lose. **Both are true here.**

- **(a) Schema-extension blocker**: backfilling the 3 V1 company-tenants into V2 today would silently drop 10+ company columns + 2 compliance-contact columns that `send-tenant-certificates` actively reads. This is the same shape as compliance Ship C → C2 (responsible_party): V2 needs new columns before we can backfill.
- **(b) Live-data blocker**: the 3 V1 rows are real, status=`active`, and named after real UK organisations (Clearsprings Ready Homes, Serco, Oxford Brookes Enterprises). 14 documents FK at them. They cannot be deleted without preserving the linkage.
- **Plus a third unknown surfaced by the audit, not in the prompt's STOP-and-ask list**: V2 already has 3 rows with the same human names but `tenant_type='private'` and no company linkage — they look like **duplicate re-entries**, not independent V2 records. If they are duplicates, the migration is a *merge* (V1 company data overlaid onto V2 row, then re-FK 14 documents), not a *backfill*. If they are intentional separate records, V2 needs different ids and the 14 documents stay on V1 ids.

### Three product-judgement questions for David before any ship

1. **Are V2's 3 rows duplicates of V1's 3 rows?** (Same names suggest yes, but only David / data owner can confirm whether `Property Team / private` in V2 is meant to represent the same lease as `Property Team / Clearsprings / company` in V1, or a genuinely different tenant. This decides merge-vs-keep.)
2. **Does V2 need the company-tenant column block** (`company_name`, `company_number`, `company_contact_*`, `vat_*`, `compliance_contact_*`, `trading_name`)? In compliance §0b we extended V2 (responsible_party). For tenants, this is a much bigger schema extension — 12+ columns. Alternative: model company tenants via a separate `tenants_v2.linked_company_id → companies` FK and drop the duplicated columns. (Cleaner long-term but bigger Ship C.)
3. **Employment / guarantor / previous-landlord blocks**: extend V2 to match V1, or accept the loss (declare them DEAD in current product scope)? David's call — the data exists for the 3 rows but no UI surfaces it today.

## Step 6 — Recommended ship sequence (conditional on Q1–Q3 above)

Mirroring the compliance §0b pattern with the schema-extension call-out from Ship C:

| Ship | Scope | Prompts | Blocker |
|---|---|---|---|
| **A** | Audit confirms `v1_freeze_guard` already on `public.tenants`; verify no double-writers via `check-no-v1-table-refs.mjs`. **Already largely shipped** — V1 is frozen, no app writers. | 0 (already done) | none |
| **A.5** | Decide Q1–Q3. Single short prompt to David. | 1 | **this audit's STOP-and-ask** |
| **B (schema)** | Migration: extend `tenants_v2` per Q2/Q3 answers (likely `company_name`, `company_number`, `compliance_contact_name`, `compliance_contact_email`, `company_contact_email` minimum to unblock `send-tenant-certificates`; full block if Q2 says yes). | 1 | depends on Q2 |
| **B (data)** | Backfill: either MERGE (overlay V1 columns onto matching V2 row by name+org, then `UPDATE documents SET tenant_id = v2_id WHERE tenant_id = v1_id`) — if Q1=duplicates; or COPY (insert V1 rows into V2 with same ids, re-FK documents not needed) — if Q1=independent. | 1 | depends on Q1 |
| **C** | Migrate the 3 V1 readers: `send-tenant-certificates/index.ts:84`, `useBatchRenameDocuments.ts:115`, `useDocumentManagement.ts:277`. Each is a single-table read, mechanical swap. | 1 |  |
| **D** | Background fns sweep — none identified beyond `send-tenant-certificates` (handled in C). | 0 |  |
| **E** | Soak (1–2 weeks) — V1 frozen, no readers, watch for any call-site missed. | 0 prompts |  |
| **F** | Drop `documents.tenant_id` FK to V1, re-point at `tenants_v2.id`, drop `public.tenants` table + indexes + policies + triggers. | 1 |  |

**Total estimate post-decisions: 4 prompts** (B-schema, B-data, C, F), plus the A.5 decision prompt now.

If David picks the "linked_company_id" path on Q2, Ship B-schema balloons into a separate companies-link sub-ship and the estimate goes to ~6 prompts.

## Inline summary

V1 `tenants`: 3 rows, all live company tenants, frozen by `v1_freeze_guard`, 14 documents FK at them, schema is much richer than V2 (12+ fields V2 lacks, of which company_name + 4 contact fields are actively read by `send-tenant-certificates`). V2 `tenants_v2`: 3 rows, name-collide with V1 but lack company linkage — likely duplicate re-entries. Disjoint id spaces. 3 V1 readers in app (all read-only), 0 writers. No mixed-mode files. No pg_depend hazards beyond the documents FK + standard triggers. **Cannot ship a Ship B without first answering: (Q1) are V2 rows duplicates of V1?, (Q2) does V2 need the company-tenant column block (or move to a `linked_company_id` FK)?, (Q3) keep or drop V1's employment/guarantor/previous-landlord fields?** Recommended path is A.5 decision prompt → Ship B-schema → Ship B-data (merge or copy depending on Q1) → Ship C (3 readers) → Ship F (drop V1). Estimate 4–6 prompts total after decisions.

No data was changed.
