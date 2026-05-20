
# Improvements 1–10 — Implementation Plan

Scope is large, so we'll ship in **4 phased waves**. Each wave is independently shippable and verifiable in preview. Nothing here changes the data model destructively — all additions are read-side composition over existing hooks/tables, plus a couple of small JSONB-backed user-preference tables.

---

## Wave A — Daily landing & visibility (items #2, #3, #14 partial)

**A1. "Today" page (`/today`)**
A single morning landing page composed from existing hooks. Sections:
- **Overdue & due-in-7-days**: compliance items (`compliance_matrix_v2`), tasks (`useTasks`), tenancy events (`useTenancyEvents`), rent arrears (`useArrearsPredictions`), filing deadlines (`useLegalEntities`).
- **Recent activity**: last 24h from `useAuditLog` + `useActivityLog`.
- **New this week**: payments matched, documents uploaded, leads added.
- **Flagged risks**: top 5 from `usePortfolioInsightsAndRisks`.
- Each row links to source record; "Snooze 7 days" + "Mark done" inline.
- Add route + sidebar entry above Dashboard. Make it the default post-login landing (behind a user preference; default ON for new users, OFF for existing).

**A2. Fix-it queue (`/fix-it`)**
Aggregates every missing-data signal into one prioritised list:
- Reuses `useMissingInfoV2`, `useDataCompletenessScoring`, compliance gaps, missing ownership %, missing valuations, missing rent on active tenancies, missing filing dates.
- Columns: Property/Entity · What's missing · Impact (High/Med/Low) · Quick fix button (opens correct drawer/wizard step).
- Filter by category + assignee. Bulk-dismiss with reason.

**A3. Skeletons for slow pages**
Replace spinners on Dashboard, Today, Fix-it, Compliance, Properties list with layout-matching skeletons.

---

## Wave B — Explainability & ownership (items #1, #4, #5)

**B1. Explainable KPIs**
- New `<KPIBreakdownPopover>` component. Click any KPI on Dashboard / Portfolio / Entity / Property → opens drawer showing inputs, formula text, contributing rows (sortable table), and a "Copy calculation" button.
- Wire to: Portfolio Value, Debt, Equity, LTV, NOI, DSCR, Net Yield, Cashflow, Rent.
- Centralise formulas in `src/lib/kpi/explainers.ts` so PDF + live UI share the source of truth.

**B2. Ownership graph extension**
- Extend `useOwnershipFlowchartData` to optionally include properties + loans beneath each entity node.
- Add toggle: "Show properties" / "Show loans" / "Beneficial vs Direct (side-by-side)".
- Add effective-date slider: render the graph as of a chosen date using existing audit history. (Read-only; no new tables — derive from `useAuditLog` JSONB diffs for ownership-related tables.)

**B3. Entity operating view parity**
- New `EntityOperatingPanel` on existing entity detail page, mirroring Property Passport shape: Value · Debt · Equity · Rent · Cashflow · LTV · Filing health · Properties list · Loans · Bank accounts · Documents · Recent activity.
- Reuses `useCompanyPropertyExposure`, `useEntityCompliance`, `useLoanFacilities`, `useEntityInvestorData`.

---

## Wave C — Power-user UX (items #6, #7, #8)

**C1. Bulk actions**
- Add `useTableSelection` hook + `<BulkActionBar>` sticky footer.
- Apply to Properties V2 list, Tenants list, Compliance list, Documents.
- Actions: Bulk tag, bulk lifecycle change, bulk export CSV, bulk archive, bulk assign owner. Permissions gated by `useUserRole`.

**C2. Saved views**
- New table `saved_views` (id, user_id, org_id, scope, name, filters_json, is_shared, created_at) with RLS.
- Generic `<SavedViewsMenu scope="properties" />` reads/writes URL search params ↔ filters.
- Applied to Properties, Compliance, Tenants, Tasks.

**C3. Search upgrades**
- Add fuzzy ranking client-side (Fuse.js, 6kb) over the `global_search` RPC results.
- Add hover-preview card (address, status, key metric) in Command Palette.
- Rank `useRecentlyViewed` matches above cold results.

---

## Wave D — Mobile & print parity (items #9, #10)

**D1. Mobile responsive tables**
- New `<ResponsiveTable>` wrapper: renders `<table>` on `md+`, stacked cards on mobile.
- Apply to Properties, Tenants, Compliance, Work Orders, Rent payments.
- Make compliance calendar collapse to a vertical agenda list under `md`.

**D2. Print/PDF parity audit**
- Add a `useReportData` shared hook consumed by both Bank Presentation PDF and live Passport.
- Snapshot test: render the same property in PDF generator + live page, diff the headline numbers.
- Fix any drift found; document in `docs/release/`.

---

## Technical notes

- **New tables**: only `saved_views` and `user_dismissed_fixit` (id, user_id, target_type, target_id, reason, dismissed_until). Both small, both RLS by user_id + org_id.
- **No V1 references**; all queries hit V2 tables per project memory.
- **Casts**: continue the `any`-cast pattern for new Supabase queries until types regen.
- **Design tokens**: navy/gold only; DM Serif Display for page H1 only; semantic tokens elsewhere.
- **Routing**: all new pages lazy-loaded in `src/App.tsx`; `usePageTitle` on each.
- **Tests**: smoke Playwright spec for `/today` and `/fix-it` load; Vitest for `kpi/explainers.ts` formulas; snapshot test for PDF/live parity.
- **Feature flags**: none — ship behind sidebar entries with `useSectionVisibility` so users can hide.

---

## Suggested shipping order

1. Wave A (biggest perceived value, ~1 build) — Today + Fix-it + skeletons
2. Wave B (high strategic value) — KPI breakdowns + ownership + entity view
3. Wave C (quality of life for heavy users) — bulk + saved views + search
4. Wave D (polish, can run partly in parallel)

I'd recommend approving the whole plan and I'll ship Wave A first, then check in before Wave B.
