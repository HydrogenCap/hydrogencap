# T8 #61 audit — STOP-and-ask before any rename ship

## Step 1 — V1-sibling audit (5 tables)

| V1 table | V1 rows | V2 rows | Δ | V1 inbound FKs | pg_depend (non-trivial) | Live `from('<v1>')` refs in src/ + edge fns | Recommendation |
|---|---:|---:|---:|---:|---|---|---|
| `properties` | 25 | 27 | **−2 (stale)** | 2 | **2 views** (`investor_return_metrics`, `investor_commitment_detail`) + RLS on `floorplans`, `ownership_links`, `storage.objects/floorplans` JOIN-ing `properties` | **23 refs** (17 edge fns: bulk-epc/price-paid, freeagent-sync, process-document, summarize-valuation, send-weekly-compliance, send-tenant-certs, etc.; 6 src hooks: useProperties, useLeaseholdDetails, useInsuranceTracker, usePropertyPhotosV2, InsurancePolicyForm) + `Tables['properties']` typed in useProperties.ts | **investigate / cutover-needed (large)** |
| `rooms` | 17 | 23 | **−6 (stale)** | 0 | none | **3 refs** (src/hooks/useUnitUsage, supabase/functions/portfolio-chat/tool-executor x2) | **precursor-needed** (small surface, but live) |
| `tenants` | 3 | 3 | 0 | 1 | none | **3 refs** (send-tenant-certificates, useBatchRenameDocuments, useDocumentManagement) | **precursor-needed** |
| `compliance_documents` | 117 | 224 | **−107 (very stale)** | 0 | **4 own RLS policies** (auto-deps via pg_depend; not blocking but rewrite needed); plus the storage RLS policy historically referenced this — confirm post-#71 | **12 refs** (process-document edge fn x3, send-tenant-certs, useCompliance x4, useRenewalWorkflow x3, TenantCertificates portal page) | **investigate / cutover-needed** (data gap is biggest of all 5) |
| `share_classes` | 19 | 19 | 0 | 0 | RLS join via `companies` (own-table, deps unwind on drop) | **10 refs** (useCompanies x5, useShareRegister x4, useCompanyLookthrough) | **precursor-needed** |

Cross-checked `check:no-v1-refs` allowlist — these 5 tables aren't in the script's `V1_TABLES` list, so CI hasn't been blocking them; the references above are all real production code.

### Critical finding (the STOP)

Three of the five V1s are being **read live by current code on data that's measurably stale vs V2**:
- `compliance_documents`: code reads V1 (117 rows) while V2 has 224 — code is missing **48% of compliance docs**.
- `rooms`: V1 17 rows vs V2 23 — useUnitUsage and portfolio-chat tool-executor see a stale unit count.
- `properties`: V1 25 vs V2 27 — useProperties (the central hook) plus 17 edge functions are reading the wrong source of truth for some rows.

The other two (`tenants`, `share_classes`) match row counts but still have substantial code traffic.

This is **not a freeze-trigger candidate set** — it's a real cutover gap. Plan §0a's "4/4 complete" claim was true only for `loans`/`tenancies`/`costs`/`income`; the V2-suffix tables that have V1 siblings are a separate, larger workstream that was never completed.

## Step 2 — 4-clean rename surface (deferred pending Step 1 decision)

For completeness, the rename surface for the 4 truly-clean V2 tables, sorted by blast radius:

| V2 → canonical | Hook files | Page/component files | Edge fn refs | SQL refs (migrations to write) |
|---|---|---|---|---|
| `property_income_budgets_v2` → `property_income_budgets` | `usePropertyIncomeBudgets.ts`, `propertyIncomeBudgetCompat.ts` | (none direct) | `_shared/propertyIncomeBudget.ts`, callers in financial summarisation fns | rename table + FK names; update RLS policy names |
| `property_cost_budgets_v2` → `property_cost_budgets` | `usePropertyCostBudgets.ts`, `propertyCostBudgetCompat.ts` | (none direct) | `_shared/propertyCostBudget.ts` + ~3 callers | rename table + FK names; update RLS |
| `compliance_requirements_v2` → `compliance_requirements` | `useCompliance.ts`, `useComplianceRequirements*.ts` | ComplianceTasks pages | `auto-compliance-pipeline`, `create-compliance-jobs`, `send-weekly-compliance-email` | rename + RLS + automation triggers |
| `compliance_contractors_v2` → `compliance_contractors` | `useComplianceContractors.ts` | JobsAndWorks, JobDetail, WorkOrderDetail | `send-job-reminders` | rename + 2 inbound FKs (work_orders, jobs) |

Order is correct — budgets first (zero UI surface), compliance second (heavier).

## Step 3 — Ship recommendation

**Do NOT ship the partial-#61 rename tonight, and do NOT queue freeze-triggers for the 5 V1 siblings as currently scoped.** The freeze pattern presumes zero live traffic; we have heavy live traffic plus measurable data drift.

Three options for David to pick between:

1. **Ship partial-#61 only (4 clean V2 → canonical), park the 5 V1 siblings entirely.** Lowest risk for tonight. The 4 renames are independent of the 5-V1 mess — they don't share names, RLS, or FKs with the dirty set. After ship, open a single multi-prompt §0b workstream to migrate src/ + edge fns from V1 → V2 for properties/rooms/tenants/compliance_documents/share_classes (one table per parked-window cycle), then freeze-soak-drop each. **Recommended.**

2. **Hold #61 entirely** until §0b lands, so the eventual rename is one clean sweep. Cleaner end-state, but parks #61 for several cycles and the 4 clean renames are zero-risk waste-of-waiting.

3. **Investigate compliance_documents first** as an urgent bug (48% data drift on a hot read path) — could be its own Plan ticket ahead of either #61 or §0b, since it may already be causing user-visible compliance gaps.

## Question for David

Which path? Default recommendation is **(1) ship partial-#61 + open §0b as a 5-prompt cutover series, with compliance_documents prioritised first inside §0b given its drift size**. Option (3) — peeling compliance_documents out as a hotfix — is also defensible if you suspect the drift has been causing support tickets.

Either way, this audit's row-drift numbers should be saved into the §0b prompt body so future-Claude doesn't repeat the "looks dropable" mistake.
