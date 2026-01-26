# Asset Tracker Refactoring Audit
*Generated: 2026-01-26*

## Executive Summary

This audit identifies structural improvements to make the app a reliable **source of truth** for property developers tracking assets across SPVs, ownership structures, and compliance regimes.

**Current Grade: B+** — Strong foundations, but some duplication and UX friction.

---

## 1. Architecture Assessment

### ✅ What's Working Well

| Component | Implementation | Notes |
|-----------|---------------|-------|
| Ownership Model | `ownership_links` table with validation trigger | Single source of truth, enforces ≤100% |
| Attribution | Recursive look-through via `useOwnershipAttribution` | Correctly traces through holding structures |
| Organization Model | Multi-tenant ready with `org_id` on all tables | SaaS-ready foundation |
| Compliance Tracking | `compliance_items` + versioned documents | Good structure, needs UX polish |
| Real-time Sync | Supabase Realtime on ownership changes | Instant cross-view updates |

### ⚠️ Areas Needing Refactor

| Issue | Impact | Priority |
|-------|--------|----------|
| Finance data scattered (loans, income, costs) | Cognitive load, calculation inconsistency | HIGH |
| Passport duplicates property fields | Confusion about source of truth | HIGH |
| Dashboard shows 8+ metrics | Information overload | MEDIUM |
| Compliance documents loosely linked | Hard to see what's missing | MEDIUM |
| Property page has 7 tabs | Decision fatigue | LOW |

---

## 2. Finance Consolidation Plan

### Current State (FRAGMENTED)
```
properties
├── current_value_gbp
├── purchase_price_gbp
├── original_purchase_date
│
loans (one-to-many)
├── current_mortgage_balance_gbp
├── interest_rate_percent
├── mortgage_payment_gbp
├── fixed_rate_expires
│
income (year-based)
├── annual_rent_gbp
│
costs (year-based)
├── management_gbp_manual
├── insurance_gbp_manual
├── repairs_gbp_manual
└── [auto-calculation rules]
```

### Proposed State (UNIFIED)
**No schema change required** — The current schema is actually well-designed. The issue is **UI presentation**, not data structure.

#### Refactor Actions:
1. **Create unified FinanceCard component** that pulls from all sources
2. **Consolidate PropertyDetail tabs**: Merge "Overview" + "Finance" into single view
3. **Add "Finance Summary" to Property header** showing key metrics
4. **Ensure calculations are consistent** across all views (already mostly done)

### Calculated Metrics (already implemented correctly)
- ✅ Equity = Value - Mortgage Balance
- ✅ LTV = (Balance / Value) × 100
- ✅ NOI = Rent - Operating Costs
- ✅ Cashflow = NOI - (Mortgage × 12)
- ✅ Yield = NOI / Value
- ✅ ROCE = NOI / Equity

---

## 3. Property Passport Simplification

### Current State (OVERLAPPING)
The passport currently contains:
- **Tier 1 (Core)**: Property type, tenure, accommodation, HMO licensing
- **Tier 2 (Advanced)**: Keysafe, utilities, amenities

**Problem**: Some fields duplicate data from canonical sources:
- `beds` → exists in both `properties` AND `property_passport`
- `tenure` → exists in both
- Ownership fields → shown in passport but authoritative data is in `ownership_links`

### Proposed State (CANONICAL REFERENCES)

#### Passport should ONLY contain:
1. **Operational data** (not stored elsewhere):
   - Keysafe code, water stop tap location
   - Meter locations, utility suppliers
   - Access instructions, emergency contacts
   - HMO-specific fields (room sizes, fire doors)

2. **Read-only references** to canonical sources:
   - Property type, beds, tenure → from `properties` table
   - Ownership → from `ownership_links` (already done)
   - EPC → from `properties.epc_rating`

#### Refactor Actions:
1. **Audit `property_passport` table** — identify truly unique fields
2. **Remove duplicate columns** if data exists in `properties`
3. **Update PassportForm** to pull canonical data as read-only
4. **Add "Confirm" state** — once all fields verified, show passport as "locked"
5. **Create "Operational Details" rename** — "Passport" implies comprehensive; "Ops Details" is clearer

---

## 4. Dashboard Focus Refactor

### Current Metrics (TOO MANY)
1. Total Portfolio Value
2. Total Equity
3. Average LTV
4. Monthly Cashflow
5. Rent per Bedroom
6. Properties count
7. Multiple widgets (Health, Compliance, Data Quality, Activity, Map)

### Proposed Metrics (CORE 4)
| Metric | Why It Matters |
|--------|----------------|
| **Attributable Equity** | "What's my real net worth in this portfolio?" |
| **Monthly Cashflow** | "Am I making or losing money right now?" |
| **Average LTV** | "How leveraged am I?" |
| **Risk Count** | "What needs attention today?" |

#### Secondary (collapsed by default):
- Gross vs Attributable toggle (already exists)
- Rent per bedroom
- Property count by area

#### Refactor Actions:
1. **Simplify header cards** to 4 key metrics
2. **Combine Risk + Compliance alerts** into single "Action Required" widget
3. **Move secondary stats** to expandable section
4. **Ensure Map uses identical data** to Properties table (already unified)

---

## 5. Compliance & Documents Unification

### Current State (PARTIALLY LINKED)
```
compliance_items
├── property_id
├── compliance_type (GAS_SAFETY, EPC, etc.)
├── expiry_date
├── issue_date
│
compliance_documents
├── compliance_item_id (FK) ✅ Good - linked!
├── file_url
├── is_current
├── version_number
│
documents (SEPARATE table)
├── property_id
├── doc_type
├── file_url
└── [AI extraction fields]
```

### Issue Analysis:
The structure is actually **correct** — `compliance_documents` links to `compliance_items`. 

**Real problem**: The `documents` table (used by Inbox) is separate from compliance. This is intentional for AI triage, but creates confusion.

### Proposed Clarification:
1. **Rename in UI**: 
   - "Documents" tab → "Files & Archive"
   - "Compliance" tab → remains "Compliance"
2. **Add "Attach to Compliance" action** on Documents page
3. **Show "Missing Document" badge** on compliance items without attached file
4. **Remove duplicate EPC handling** — EPC is both compliance item AND property field

#### Refactor Actions:
1. **Add `has_document` indicator** to ComplianceItemRow
2. **Improve "Add Document" flow** from compliance item
3. **Consolidate EPC**: Either in compliance OR property, not both
4. **Add proactive alerts**: "5 documents expiring this month"

---

## 6. Page Hierarchy Refactor

### Current Navigation
```
Dashboard
Properties
Companies
Ownership (redundant?)
Insights
Map
Compliance
Missing Info
Settings
```

### Proposed Navigation (Simplified)
```
Dashboard          → 4 key metrics + action required
Portfolio          → Properties list (absorbs Map as view toggle)
Companies          → SPV control centre
Compliance         → Portfolio-wide compliance register
Insights           → AI analysis + trends
Settings           → User, org, integrations
```

**Removed/Merged:**
- ❌ Ownership → Already managed at Property + Company level
- ❌ Missing Info → Becomes filter/view in Properties ("Data Quality" view)
- ❌ Map → Toggle within Portfolio page

---

## 7. Technical Debt Identified

| Issue | Severity | Fix | Status |
|-------|----------|-----|--------|
| `calculateMonthlyCashflow` legacy function still exists | Low | Remove after confirming no usage | - |
| Passport meter fields fragmented | Medium | Complete migration to `meter_notes` | - |
| Multiple formatGBP variants | Low | Consolidate to 2 (with/without decimals) | - |
| Dashboard recalculates on every render | Medium | Add useMemo optimization | ✅ DONE |
| Properties.tsx is 1180+ lines | High | Extract table columns, filters, views into modules | ✅ DONE |
| Passport duplicate columns (beds, baths, tenure) | High | Migration to drop duplicate columns | ✅ DONE |

---

## 8. Implementation Phases

### Phase 1: Finance UX (1-2 days)
- [ ] Create unified FinanceCard component
- [ ] Simplify PropertyDetail to fewer tabs
- [ ] Ensure all cashflow calculations consistent

### Phase 2: Dashboard Focus (1 day)
- [ ] Reduce header to 4 key metrics
- [ ] Combine risk widgets into "Action Required"
- [ ] Add attributable vs gross clarity

### Phase 3: Passport Cleanup (1 day)
- [ ] Audit for duplicate fields
- [ ] Make canonical fields read-only
- [ ] Rename to "Operational Details"

### Phase 4: Compliance Polish (1 day)
- [ ] Add document attachment indicators
- [ ] Improve proactive alerts
- [ ] Consolidate EPC handling

### Phase 5: Navigation Simplify (0.5 days)
- [ ] Merge Map into Portfolio
- [ ] Move Missing Info to Properties view
- [ ] Remove redundant Ownership page

---

## 9. Recommended Next 5 Features (Post-Refactor)

1. **Bulk Operations** — Update multiple properties at once
2. **Export/Reporting** — PDF portfolio summary, compliance pack
3. **Investor Portal** — Read-only view for stakeholders
4. **Refinance Modelling** — "What if" scenarios for rate changes
5. **Notifications** — Email/push for expiring compliance, rate ends

---

## 10. Success Metrics

After refactoring, the app should:
- [ ] Answer "What's my exposure?" in <10 seconds
- [ ] Show clear attributable vs gross distinction
- [ ] Have no duplicate data entry points
- [ ] Reduce Property page tabs from 7 to 4
- [ ] Reduce Dashboard widgets from 8 to 5

---

*This document serves as the refactoring roadmap. Each phase should be completed and tested before moving to the next.*
