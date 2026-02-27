# HydrogenCap V2 Spec Gap Analysis

**Date:** 27 February 2026  
**Scope:** Cross-reference of V2 Scope Definition spec against live codebase  
**Repo analysed:** hydrogencap-main (full source audit)

---

## Summary Scorecard

| Spec Section | Score | Key Gap |
|---|---|---|
| 2.1 Ownership Engine | 70% | No historical date support |
| 2.2 Gross vs Attributable | 30% | Attribution engine exists but not shown on main dashboard |
| 2.3 Aggregation Engine | 60% | Gross works, Hydrogen-specific aggregation missing |
| 2.4 Share Integrity | 15% | No issued shares field in V2, no validation, three competing systems |
| 2.5 Snapshot Financial Model | 40% | P&L snapshots work, but no balance sheet snapshots (valuation/debt) |
| 3.1 Ownership Service | 25% | Hooks exist but not as reusable date-parameterised services |
| 3.2 KPI Service | 40% | Gross KPIs work, Hydrogen-specific not built |
| 3.3 Dashboard Contract | 20% | No `{ gross, hydrogen }` data shape implemented |

**Overall verdict:** The ownership plumbing is impressively thorough — recursive look-through, circular loop protection, multi-path aggregation. But the spec's two headline deliverables — **side-by-side Gross vs Hydrogen on the dashboard** and **snapshot-based balance sheet** — aren't wired up. The engine is built but the cockpit gauges aren't connected to it.

---

## 2.1 Deterministic Ownership Engine

### What the spec requires

- Ownership % = Shares Held ÷ Issued Shares
- Must dynamically calculate ownership at snapshot date
- Must respect effectiveFrom / effectiveTo ranges
- No hardcoded ownership assumptions
- Hydrogen is treated as a shareholder, not parent entity

### What's built

| Requirement | Status | Evidence |
|---|---|---|
| Ownership % = Shares Held ÷ Issued Shares | ✅ Built | `useOwnershipAttribution.ts` line 190: `shareholderPercent = (holding.shares_held / shareClass.issued_shares) * 100` |
| Dynamically calculate at snapshot date | ⚠️ Partial | Uses `.is('effective_to', null)` (line 142) — filters to current shareholdings only. No function accepts an arbitrary historical date. |
| Respect effectiveFrom / effectiveTo ranges | ⚠️ Partial | `effective_to IS NULL` is checked, but `effective_from` is never validated. A shareholding with `effective_from = '2025-06-01'` that hasn't started yet would still be included. |
| No hardcoded ownership assumptions | ✅ Built | No hardcoded percentages. Falls back to SPV shareholders → company as terminal owner — all dynamic. |
| Hydrogen treated as shareholder, not parent | ✅ Built | `resolveUltimateBeneficiaries()` (line 443) recursively traces holding companies. Hydrogen Capital is just another party in `ownership_links`. |

### Gap

The spec calls for `getOwnership(spvId, partyId, date)` as a reusable service. What exists is a React hook (`usePropertyAttribution`) that only works for the current date. No historical date parameter. This means you cannot generate a report saying "what was our exposure on 31 Dec 2024" — which is exactly what a lender or investor would ask for.

---

## 2.2 Gross vs Attributable Portfolio Split

### What the spec requires

Dashboard must clearly display:

| Metric | Gross Portfolio | Hydrogen Attributable |
|---|---|---|
| Portfolio Value | 100% | % ownership adjusted |
| Total Debt | 100% | % adjusted |
| Equity | 100% | % adjusted |
| Monthly Cashflow | 100% | % adjusted |
| Weighted LTV | Weighted | Weighted |

### What's built

| Requirement | Status | Evidence |
|---|---|---|
| Dashboard shows Gross vs Hydrogen side-by-side | ❌ Not built | Dashboard `portfolioStats` calculates from V1 `properties` fields directly — all 100% gross. No Hydrogen attributable column on the KPI cards. |
| Attribution data exists | ✅ Built | `usePortfolioAttribution` (line 534) correctly calculates per-owner attributable value, equity, debt, rent, NOI, cashflow. |
| Attribution is displayed | ⚠️ Separate tab only | Dashboard has a "Shareholders" tab showing `DashboardShareholdersTab`. But the main Overview tab KPIs are gross-only. |

### Gap

The attribution engine exists and works, but the Dashboard doesn't use it for the main KPIs. The spec's dual-column table (Gross | Hydrogen Attributable side by side) is not implemented. The shareholder tab shows per-owner breakdowns but not the spec's dashboard format.

---

## 2.3 Portfolio Aggregation Engine

### What the spec requires

- Sum of valuations, debt, equity across ACTIVE SPVs only
- Weighted LTV = Σ(Debt) ÷ Σ(Value)
- Hydrogen Weighted LTV must use attributable debt/value only

### What's built

| Requirement | Status | Evidence |
|---|---|---|
| Sum of valuations | ✅ | `portfolioStats.totalValue` in Dashboard |
| Sum of debt | ✅ | `portfolioStats.totalMortgage` |
| Sum of equity | ✅ | `portfolioStats.totalEquity` |
| Weighted LTV = Σ(Debt) ÷ Σ(Value) | ✅ | `portfolioStats.averageLTV` |
| Active SPVs only | ⚠️ | Filtered by `lifecycle_type === 'core_rental'` on the property, not by entity status. Dormant/dissolved entities with `core_rental` properties still appear. |
| Hydrogen Weighted LTV (attributable) | ❌ | Not calculated anywhere. Attribution hook calculates per-owner totals but no `getHydrogenWeightedLTV()` function exists. |

### Gap

Gross aggregation works. Hydrogen-specific aggregation (attributable weighted LTV = Σ Hydrogen debt ÷ Σ Hydrogen value) doesn't exist as a computed metric.

---

## 2.4 Share Integrity Enforcement

### What the spec requires

- No negative shares
- No fractional rounding drift beyond defined precision
- Sum(Shareholdings) = IssuedShares
- Prevent saving if share total mismatch
- Prevent duplicate overlapping share date ranges
- Transaction-safe updates

### What's built

| Requirement | Status | Evidence |
|---|---|---|
| No negative shares | ⚠️ Frontend only | `ShareholderFormModal` line 65: `shares <= 0` check. No DB constraint. |
| Sum(Shareholdings) = IssuedShares | ❌ Not built | `legal_entities` has no `issued_shares` field. `entity_shareholders` stores `shares_held` and `share_class` (text) but nothing to validate against. |
| Prevent saving if mismatch | ❌ | No validation — any combination of shareholdings can be saved. |
| Prevent duplicate overlapping date ranges | ❌ | `ownership_links` has `effective_from`/`effective_to` but no overlap check anywhere. |
| Transaction-safe updates | ❌ | Client-side Supabase mutations, not DB transactions. |

### Critical structural issue: Three competing ownership systems

The spec's core principle — `Ownership % = Shares Held ÷ Issued Shares` — has three competing implementations, none of which enforces integrity:

1. **V1 system** (`companies` → `share_classes` → `shareholdings`): Has `issued_shares` on share classes and `shares_held` on shareholdings. The arithmetic exists in `useOwnershipAttribution` line 190. But no save-time validation that they sum correctly.

2. **ownership_links** (unified table used by beneficial ownership): Stores `percent` directly with an optional `shares` field. Bypasses the shares÷issued calculation entirely. This is the table used by the newer ownership flowchart and attribution engine.

3. **V2 entity_shareholders**: Simple table with `shares_held` and a text `share_class` field. No `issued_shares` column to divide by. No integrity checks.

### Gap

No system enforces that shareholdings sum to 100% or that shares_held sums to issued_shares. A user can enter 60% + 60% = 120% and the system will happily save it and calculate attribution on that basis.

---

## 2.5 Snapshot-Based Financial Model

### What the spec requires

Each snapshot includes: Valuation, Debt, Equity, Cashflow, Snapshot date.

Rules:
- Only latest snapshot per SPV used in dashboard
- Historical snapshots preserved
- No retroactive modification without audit trail

### What's built

The `financial_snapshots` table contains these fields:

```
snapshot_month, property_id, entity_id, org_id,
gross_rent_due, gross_rent_received, other_income,
mortgage_payments, management_fees, maintenance_costs,
insurance_costs, utilities, council_tax, licensing_costs,
professional_fees, other_costs, void_loss,
total_costs (computed), net_operating_income (computed),
net_cash_flow (computed), rent_collection_rate (computed),
occupancy_rate, is_locked, locked_at, locked_by, notes
```

| Requirement | Status | Evidence |
|---|---|---|
| Snapshot includes Valuation | ❌ | No valuation field on `financial_snapshots`. Valuation lives as a single point-in-time field on V1 `properties.current_value_gbp` or V2 `properties_v2.current_valuation`. |
| Snapshot includes Debt | ❌ | No debt/mortgage balance field. Debt comes from V1 `loans.current_mortgage_balance_gbp` or V2 `loan_facilities.current_balance`. |
| Snapshot includes Equity | ❌ | Calculated on-the-fly as Value − Debt. Since neither is snapshot-based, equity isn't either. |
| Snapshot includes Cashflow | ✅ | `financial_snapshots.net_cash_flow` (computed from rent − costs − mortgage payments). |
| Only latest snapshot per SPV | ✅ | Views like `portfolio_monthly_summary` aggregate by latest month. |
| Historical snapshots preserved | ✅ | Monthly snapshots upserted per property+month. Never overwritten. |
| No retroactive modification without audit trail | ✅ | `is_locked`, `locked_at`, `locked_by` fields. `useLockMonth` hook prevents edits to locked months. |

### Gap

The spec says each snapshot should contain a **complete financial position** (valuation + debt + equity + cashflow). What's built is a monthly **P&L snapshot** (income and costs only) — not a balance sheet snapshot.

You can answer "what was our net operating income in March?" but NOT:
- "What was our portfolio valued at in March?"
- "What was our LTV in March?"
- "What was our equity position in March?"

To fix this, `financial_snapshots` needs at minimum two new fields: `valuation_at_snapshot` and `debt_at_snapshot`. Equity would then be computed as `valuation_at_snapshot - debt_at_snapshot`.

---

## 3.1 Ownership Calculation Layer

### What the spec requires

Reusable service:
- `getOwnership(spvId, partyId, date)`
- `getHydrogenOwnership(spvId, date)`

Must handle historical date logic, inactive SPVs, and return deterministic values.

### What's built

| Requirement | Status | Evidence |
|---|---|---|
| `getOwnership(spvId, partyId, date)` | ❌ | `usePropertyAttribution` exists but takes no date parameter — always queries current ownership only. |
| `getHydrogenOwnership(spvId, date)` | ❌ | No concept of a "Hydrogen Capital" identity as a special query. Hydrogen is just another party in `ownership_links`. |
| Handle historical date logic | ❌ | Only filters `effective_to IS NULL`. Does not filter by `effective_from <= date` or `effective_to >= date`. |
| Handle inactive SPVs | ⚠️ | Filtered by V1 `lifecycle_type` on the property, not entity status. |
| Return deterministic value | ✅ | Pure function given fixed ownership data. |

### Gap

The spec envisions these as standalone, date-parameterised utility functions callable from anywhere (reports, dashboards, exports). What exists are React hooks tightly coupled to the component lifecycle with no date parameter.

---

## 3.2 Portfolio KPI Service

### What the spec requires

Reusable aggregation service:
- `getGrossPortfolioMetrics()`
- `getHydrogenPortfolioMetrics()`
- `getWeightedLTV()`
- `getHydrogenWeightedLTV()`

Must avoid duplicate logic, be pure & testable, use snapshot-based data only.

### What's built

| Requirement | Status | Evidence |
|---|---|---|
| `getGrossPortfolioMetrics()` | ✅ | Dashboard `portfolioStats` useMemo calculates total value, debt, equity, LTV. |
| `getHydrogenPortfolioMetrics()` | ❌ | Attribution data exists per-owner but no function filters to Hydrogen's specific totals. |
| `getWeightedLTV()` | ✅ | `portfolioStats.averageLTV`. |
| `getHydrogenWeightedLTV()` | ❌ | Not built. |
| Pure & testable | ⚠️ | Calculations are inline in React useMemo blocks, not extracted as pure utility functions. |
| Snapshot-based data only | ❌ | KPIs use live V1 property fields (`current_value_gbp`, `mortgage_balance`), not financial snapshots. |

### Gap

Gross KPIs work but are calculated from live V1 property fields, not snapshots. Hydrogen-specific KPIs don't exist. Nothing is extracted as a testable pure function — it's all inline in Dashboard.tsx.

---

## 3.3 Dashboard Data Contract

### What the spec requires

Frontend must receive:

```json
{
  "gross": {
    "value": 0,
    "debt": 0,
    "equity": 0,
    "cashflow": 0,
    "ltv": 0
  },
  "hydrogen": {
    "value": 0,
    "debt": 0,
    "equity": 0,
    "cashflow": 0,
    "ltv": 0
  }
}
```

### What's built

- **Gross metrics:** Calculated inline in Dashboard.tsx `portfolioStats` useMemo from V1 `properties` array. Not a service, not a data contract — just local state derivation.
- **Hydrogen metrics:** Not calculated for main KPI cards. `usePortfolioAttribution` returns per-owner breakdowns but nobody aggregates to a "Hydrogen" summary.
- **Shareholders tab:** Shows per-owner attributable breakdown — closest to the spec's attributable view, but separate tab, not side-by-side.

### Gap

No `{ gross, hydrogen }` data shape exists anywhere in the codebase. The Dashboard would need to identify which party is "Hydrogen Capital", aggregate their attribution totals, and display both columns on the main Overview KPI cards.

---

## Additional Issues Found During Audit

### Dashboard is entirely V1

The main landing page imports `useProperties` (V1), `useTenancies` (V1), and `useRooms` (V1). Every KPI comes from V1 `properties` table fields. After V1→V2 migration, if V1 data goes stale, the dashboard shows wrong numbers.

### Actions page + sidebar badges are V1

`usePortfolioRisks` drives the Actions page and sidebar badge count. It pulls from V1 `useProperties`, V1 `useCompliance` (compliance_items), V1 `useTenancies`, V1 `useInsurance`. After migration, compliance alerts go silent.

### PropertyDetailV2 has duplicate/dead sections

- Lines 174-178: Placeholder Compliance card saying "will be available once compliance documents are linked"
- Lines 191-192: The actual working `PropertyComplianceSectionWrapper` renders right below it
- Line 59-61: Dead `PropertyFinancialChart` placeholder, even though `PropertyFinancialSection` is already wired up on line 181
- Line 196-199: Placeholder Documents card that does nothing

### Rent Collection is entirely V1

`rent_schedule` → FK to V1 `tenancies` → FK to V1 `properties`, `rooms`, `tenants`. The whole chain is V1. Section 2.1 (Rent Reconciliation) builds on top of this.

### Maintenance + Jobs reference V1

`maintenance_requests.property_id` → V1 `properties`, `room_id` → V1 `rooms`, `tenant_id` → V1 `tenants`. `contractor_jobs.property_id` → V1 `properties`, `compliance_item_id` → V1 `compliance_items`.

### Pages still on V1 useProperties

Dashboard, DashboardMap, Insights, Reports, Pipeline, Timeline, Passport, ComplianceCalendar, Actions (via usePortfolioRisks).

### Three ownership systems in parallel

1. V1: `companies` → `share_classes` → `shareholdings`
2. Unified: `ownership_links` (percent-based, used by attribution engine)
3. V2: `legal_entities` → `entity_shareholders` (no issued_shares)

---

## Recommended Priority Order

### Before 2.1 upgrades (foundation cleanup)

1. **Repoint Dashboard to V2** — switch `useProperties` → `usePropertiesV2`, `useTenancies` → `useTenancyAgreements`, `useRooms` → `useRoomsV2`
2. **Repoint usePortfolioRisks to V2** — fixes Actions page and sidebar badges
3. **Clean up PropertyDetailV2** — remove three dead placeholder sections
4. **Add balance sheet fields to financial_snapshots** — `valuation_at_snapshot` and `debt_at_snapshot` columns

### V2 spec completion (after migration stable)

5. **Add `issued_shares` to `legal_entities`** — enable share integrity validation
6. **Build share integrity enforcement** — DB constraints + frontend validation that shareholdings sum correctly
7. **Add date parameter to ownership attribution** — `getOwnership(spvId, partyId, date)` as pure utility function
8. **Build Hydrogen attributable KPI aggregation** — identify Hydrogen party, compute `{ gross, hydrogen }` data contract
9. **Wire dual-column dashboard** — Gross | Hydrogen Attributable side by side on main KPI cards
10. **Consolidate to single ownership system** — retire V1 `share_classes`/`shareholdings`, keep `ownership_links` as source of truth

### Safe to build now (no V1 conflicts)

- Section 2.4: Companies House sync (uses `legal_entities` — already V2)
- Section 2.5: AI Classification (uses `compliance_documents_v2` — already V2)
- Section 2.6: Investor Portal (uses `legal_entities` + `financial_snapshots` — already V2)
- Section 2.7: Accounting Export (uses `financial_snapshots` — already V2)
