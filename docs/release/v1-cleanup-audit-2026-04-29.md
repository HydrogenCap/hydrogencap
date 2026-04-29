# V1 Hook Cleanup Audit — 2026-04-29

**Plan reference:** §3.1 Stage C  
**Stage A status:** Complete (V1 writes throw via `src/lib/v1Frozen.ts`)  
**Stage C scope:** Remove dead V1 hook files for `properties` / `rooms` / `tenants`.  
**Out of scope (per Plan §0a):** V1 hooks for loans / income / costs / tenancies — no V2 replacement, breaking these would break rent reminders, P&L, financial forecast.

---

## 1. Files audited

| File | LOC | Purpose | Verdict |
| --- | ---: | --- | --- |
| `src/hooks/useProperties.ts` | 285 | V1 property reads + frozen mutations + **active** loan/income/costs mutations | **KEEP** (mixes frozen + active) |
| `src/hooks/useRooms.ts` | 203 | V1 rooms read + frozen mutations | **DELETED** |
| `src/hooks/useTenants.ts` | 223 | V1 tenants read + frozen mutations | **DELETED** |
| `src/hooks/usePropertiesCompat.ts` | 220 | V2-backed adapter returning V1 shape | **KEEP** (40+ importers, V2-backed) |

No `src/hooks/v1/` folder exists. No other `*Compat` shims for these entities.

---

## 2. Importer audit

### 2a. `useTenants` (V1) — **0 importers**
```
$ rg -l "from ['\"]@/hooks/useTenants['\"]|from ['\"]\./useTenants['\"]" src/
(no results)
```
✅ Safe to delete. Done.

### 2b. `useRooms` (V1) — **1 importer (migrated)**

| File | What it imported | Read / Mut | V2 equivalent | Action |
| --- | --- | --- | --- | --- |
| `src/components/dashboard/OccupancyWidget.tsx` | `useRooms()` (all rooms) | Read | `rooms_v2` direct query — `usePropertyRoomSummaries` requires per-property aggregation | Migrated to inline `supabaseAny.from('rooms_v2')` query with V2→V1 status mapping |

Status mapping applied in widget:
- `occupied` → `occupied`
- `under_offer` → `notice`
- `refurbishment`, `unavailable` → `maintenance`
- `vacant` (default) → `vacant`

Lettable filter (`is_lettable = true`) added so non-bedroom amenities (bathroom/kitchen/etc.) don't dilute the occupancy %.

✅ File deleted after migration.

### 2c. `useProperties` (V1) — **30+ importers — KEEP**

The V1 file cannot be deleted in this pass. It exposes both:

- **Frozen mutations** (throw via `throwV1Frozen`): `useCreateProperty`, `useUpdateProperty`, `useDeleteProperty`
- **Active mutations** (still write to V1 tables): `useCreateLoan`, `useUpdateLoan`, `useUpsertIncome`, `useUpsertCosts`
- **Active reads**: `useProperty(id)`, `useProperties()` returning V1 shape with `loans/income/costs/tenancies` joins

Per Plan §0a, loans/income/costs/tenancies have **no V2 replacement** — touching them is forbidden.

Importer breakdown:

| Bucket | Count | Files |
| --- | ---: | --- |
| Type-only (`PropertyWithFinancials`) — re-exported via Compat already | 5 | `useDashboardDataV2.ts`, `useGoLiveChecklist.ts`, `useDuplicateDetection.ts`, `useBeneficialGroups.ts` (+ `usePropertiesCompat.ts` as canonical re-export) |
| `useProperty(id)` V1 read (V1 shape with loans/income/costs) | 6 | `LegalOwnerCard.tsx`, `DerivedBeneficialOwnershipCard.tsx`, `LegalOwnershipEditor.tsx`, `LifecycleSwitcher.tsx`, `GoLiveChecklist.tsx`, `CoreIdentityCard.tsx` |
| `useProperties()` V1 list | 3 | `LocationSettingsTab.tsx`, `useCalendarEvents.ts`, `useReportGeneration.ts` |
| Frozen mutations (`useUpdateProperty`) | 4 | `MissingInfoPropertyRow.tsx`, `LegalOwnershipEditor.tsx`, `LifecycleSwitcher.tsx`, `PropertyEdit.tsx` |
| Active loan/income/cost mutations (**forbidden by §0a**) | 5 | `MissingInfoPropertyRow.tsx`, `CostsEditor.tsx`, `PropertyNew.tsx`, `PropertyEdit.tsx` |

**Uncertain (do NOT touch in this pass):** All of the above. Reasons:
1. Loan/income/cost mutations have no V2 equivalent.
2. `useProperty(id)` returns V1 shape (`address_line`, `loans`, `income`, `costs`, `tenancies` arrays) — V2 `usePropertyV2` returns a different shape (`address_line_1`, no nested financials). Migration requires per-component refactor to consume `usePropertiesCompat` (V2-backed, V1-shape) or a new `usePropertyCompat(id)` adapter — out of scope here.
3. Frozen mutations on properties that throw at runtime are dead-but-harmless; safe to leave until §0a closes.

### 2d. `usePropertiesCompat` (V2-backed adapter) — KEEP

40+ importers across `src/components/`, `src/pages/`, `src/lib/`, `src/hooks/`. This is the V2-backed replacement returning V1-shape; not "dead" code, not a delete candidate.

---

## 3. Direct V1 table queries in `src/`

```
$ rg -l "\.from\(['\"]properties['\"]\)|\.from\(['\"]rooms['\"]\)|\.from\(['\"]tenants['\"]\)" src/
```

| File | Table | Purpose | Verdict |
| --- | --- | --- | --- |
| `src/hooks/useUnitUsage.ts` | `rooms` | Counts total rooms for subscription tier limit | **Uncertain** — should migrate to `rooms_v2`, but counts may differ if V1/V2 unsynced; needs validation against active subscription gating |
| `src/hooks/usePropertyPhotosV2.ts` | `properties` | V2→V1 address bridge to find legacy `photos` rows | **Uncertain** — bridge by design until photos migrate to V2-keyed storage |
| `src/hooks/useInsuranceTracker.ts` | `properties` | Reads V1 properties for legacy insurance display | **Uncertain** — V2 equivalent shape mismatch |
| `src/hooks/useDocumentManagement.ts` | `tenants` | Reads V1 tenant list for document tagging | **Uncertain** — needs `tenants_v2` schema parity check |
| `src/hooks/useBatchRenameDocuments.ts` | `tenants` | Reads V1 tenant names for bulk rename | **Uncertain** — same as above |
| `src/hooks/useLeaseholdDetails.ts` | `properties` | Reads V1 property for leasehold legacy fields | **Uncertain** — V2 leasehold fields not mapped |
| `src/hooks/usePassportPageData.ts` | `properties` | V1 property read in passport page | **Uncertain** — passport partially migrated |
| `src/components/insurance/InsurancePolicyForm.tsx` | `properties` | V1 property dropdown options | **Uncertain** — paired with `useInsuranceTracker` |

All of the above also fall outside this pass: each needs per-call-site validation that the V2 schema covers the consumed columns, which is per-feature work.

---

## 4. Actions applied

| Action | File | Notes |
| --- | --- | --- |
| Migrate to `rooms_v2` | `src/components/dashboard/OccupancyWidget.tsx` | Inline query, status mapping, `is_lettable=true` filter |
| Delete | `src/hooks/useRooms.ts` | 203 LOC removed; zero importers post-migration |
| Delete | `src/hooks/useTenants.ts` | 223 LOC removed; zero importers |

**Total LOC removed:** 426  
**Total importer call sites migrated:** 1 (`OccupancyWidget`)  
**`types.ts` line-count delta:** 0 (auto-generated from DB schema; V1 tables `properties`/`rooms`/`tenants` still exist in DB)

---

## 5. Verification

- `npx tsc --noEmit` — ✅ clean (exit 0, no output)
- `bunx vitest run` — ✅ **1090 / 1090** passing (83 test files), 53s

---

## 6. Uncertain list (no action taken)

### A. `useProperties.ts` cannot be deleted yet
Mixes frozen V1 property mutations with **active** V1 mutations on `loans`, `income`, `costs` tables. Per Plan §0a, those four tables have no V2 replacement. Splitting the file would require per-mutation migration to V2 equivalents that don't exist.

**Recommendation:** Resolve §0a (V2 financial primitives for loans/income/costs/tenancies) before attempting to delete `useProperties.ts`. At that point, the work splits into:
1. Move `useCreate/UpdateLoan`, `useUpsertIncome`, `useUpsertCosts` to a new `useFinancialsV2.ts` against the new V2 financial tables.
2. Migrate the 6 `useProperty(id)` V1-shape consumers to either `usePropertyCompat(id)` (new adapter) or to `usePropertiesCompat` filtered.
3. Then delete `useProperties.ts`.

### B. Direct V1 `from()` queries (8 sites listed in §3)
All require per-feature schema-parity validation. Several are explicit V1↔V2 bridges (`usePropertyPhotosV2`, `useUnitUsage`) by design.

### C. `PropertyWithFinancials` type re-home
The type currently lives in `useProperties.ts` and is re-exported by `usePropertiesCompat.ts`. Re-homing was deferred — adds churn without enabling deletion (the type's defining file can't be deleted anyway, see A).

---

## 7. Files changed

- `src/components/dashboard/OccupancyWidget.tsx` — migrated to `rooms_v2`
- `src/hooks/useRooms.ts` — **deleted**
- `src/hooks/useTenants.ts` — **deleted**
- `docs/release/v1-cleanup-audit-2026-04-29.md` — this file
