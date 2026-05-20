## Entities Page Upgrade Plan

Six focused improvements to the `/entities` list page, keeping detail-page work out of scope. Built on top of existing hooks (`useLegalEntities`, `useEntityVerificationStatus`, `usePropertiesV2`, `useAllLoanFacilities`).

---

### 1. KPI Header Strip
Add a 4-card summary row above the filter bar showing portfolio-wide entity stats:

- **Total entities** (with breakdown chip: SPVs / Personal / JV / Trust)
- **Aggregate portfolio value** (sum across all entities)
- **Aggregate debt + blended LTV**
- **Filings attention needed** (count of overdue + due-within-30d Accounts/Confirmation Statements) — clickable to filter

### 2. Quick Filter Chips + Saved Filter State
Replace the lone sort dropdown with a chip row:
- All • SPV • Personal • JV/Trust • Group Parent • Stale sync (>24h) • Filings overdue • Filings <30d • Dormant
- Chips combine with the search box. Active filter count badge.
- Persist last filter to `localStorage` so it survives reloads.

### 3. Mobile-Responsive Table
Convert the 11-column `<Table>` to `ResponsiveTable` (same pattern used on Tenants, Lending, Investors). Mobile shows Name + Type + Value + LTV; rest collapse into expandable card. Solves the horizontal scroll on small screens.

### 4. Bulk Action Toolbar
Add a checkbox column. When ≥1 row selected, replace the filter bar with a sticky action toolbar:
- **Sync selected** (CH sync only the selection)
- **Export CSV** (entity register snapshot)
- **Archive / mark dormant** (status update)
- **Clear selection**

Keeps "Sync All SPVs" button for the no-selection case.

### 5. Per-Row Sync Indicators & Last-Synced Pill
- Replace the static "Verified / Mismatch / Not Synced" cell with a richer pill that includes the relative timestamp ("2h ago", "5d ago", "Never").
- Show a small spinner inline on the row while that specific entity is syncing (via `useSyncEntity` mutation state keyed by entityId).
- Add an inline "Sync now" icon button on hover for one-off refresh without leaving the page.

### 6. CSV Export of Entity Register
Add a "Export" button next to "Add Entity" that downloads a CSV of the currently filtered list with columns: Entity Name, Company Number, Type, Status, Properties, Value, Debt, LTV, Monthly Rent, CH Status, Accounts Due, Confirmation Due, Last Synced. Reuses the existing CSV utility pattern from Data Export Utilities V2.

---

### Out of scope (suggested follow-ups, not in this plan)
- Detail-drawer / row expand with Officers + Shares + Filings
- Filings deadline tracker as a dedicated page widget
- AML/KYC director tracking
- PSC/Director change diff alerts after sync
- Per-entity P&L card

### Technical notes
- All work is frontend-only in `src/pages/Entities.tsx` plus 1–2 small component splits (`EntitiesKPIStrip.tsx`, `EntitiesBulkBar.tsx`, `EntitiesFilterChips.tsx`).
- No DB migrations. No edge function changes.
- Reuse `ResponsiveTable` + `ColumnConfig` from `@/components/common`.
- Reuse existing CSV export helper if one exists; otherwise inline a small `Blob` + `URL.createObjectURL` helper.
- The existing auto-sync `useEffect` stays; per-row sync spinners will hook into the same `useSyncEntity` mutation.
- Brand styling preserved (navy/gold, semantic tokens — no hardcoded colors).
