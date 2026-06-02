# Surface-area reduction pass

The app has ~80 page routes and a sidebar with 4 sections, 30+ leaf destinations. That breadth is the single biggest "feels heavy" signal. Goal: collapse the nav to roughly **20 top-level destinations**, remove dead/duplicate routes, and fold useful sub-views into their natural parents as tabs or filters — without losing any working functionality.

This is presentation/routing work only. No DB, no business logic, no edge functions.

## Targets (what gets folded or removed)

```text
KEEP (top nav)              ABSORBS / REPLACES
────────────────────────────────────────────────────────────────────
Today                       Fix-it queue, Actions, Missing info,
                            Data Quality  → tabs inside Today
Dashboard                   Dashboard map → tab
Properties (V2)             Pipeline → "Lifecycle: development" filter
Entities                    Ownership → tab on entity & portfolio
Compliance Hub              already consolidated last phase ✓
Lettings                    Tenants, Rent, Voids, Lettings Pipeline
                            → tabs in one Lettings workspace
Finance                     Lending, Refinancing, Financials, Investors,
                            Distributions, Insurance, Accounting, Tax,
                            Tax Engine, Forecast → tabs in Finance
Contractors                 Jobs & Works, CapEx → tabs
Inspections                 stays (small but distinct)
Documents                   Templates, Bulk Upload, Bulk Scanner → tabs
Insights                    Timeline, Performance, Val. Alerts,
                            Portfolio Timeline, Chat, AI Reports,
                            Acquisition Advisor → tabs / cards
Reports                     stays (artifact generator)
Admin                       Team, Import, Audit Log, System Health,
                            Migration, Webhooks, Settings → tabs in
                            Settings (each becomes a settings section)
```

Net effect: sidebar drops from **30+ leaves to ~12 top-level items**, each opening into a workspace with consistent tabs (same pattern the Compliance Hub already uses).

## Routes — keep, redirect, remove

**Keep** every page component file — they remain importable as tabs.

**301 redirect** the following URLs to their new homes (so bookmarks, deep links, and external references don't break):

```text
/fix-it              → /today?view=fix-it
/missing-info        → /today?view=missing-info
/data-quality        → /today?view=data-quality
/actions             → /today?view=actions
/dashboard/map       → /dashboard?view=map
/pipeline            → /properties-v2?lifecycle=development
/ownership           → /entities?view=ownership
/voids               → /lettings?view=voids
/rent                → /lettings?view=rent
/tenants-v2          → /lettings?view=tenants  (detail routes /tenants-v2/:id keep their URL)
/lettings-pipeline   → /lettings?view=pipeline
/lending             → /finance?view=lending
/refinancing-opportunities → /finance?view=refinancing
/financials          → /finance?view=overview
/investors           → /finance?view=investors
/distributions       → /finance?view=distributions
/insurance           → /finance?view=insurance
/accounting          → /finance?view=accounting
/tax /tax-engine     → /finance?view=tax
/financial-forecast  → /finance?view=forecast
/jobs-and-works      → /contractors?view=jobs
/capex               → /contractors?view=capex
/templates           → /documents?view=templates
/bulk-upload         → /documents?view=bulk-upload
/bulk-scanner        → /documents?view=bulk-scanner
/timeline /portfolio-timeline /valuation-alerts → /insights?view=…
/chat                → /insights?view=chat
/investor-reports    → /insights?view=ai-reports
/acquisition-advisor → /insights?view=acquisition
/audit-log /webhooks /system-health /migration /team /import /import/passport → /settings?section=…
```

**Hard-remove** (no redirect — these are unused/duplicated):

- `Communications.tsx` — covered by Notification Centre + Inbox
- `Insights.tsx` (the dashboard wrapper) — replaced by tabbed Insights workspace built from existing components
- `RegulatoryMonitor` as a top-level item — keep the route, demote to a tab under Compliance Hub (already half there)
- Any V1 redirect helpers still referencing dead `/properties/:id` and `/tenants/:tenantId` shells: keep the redirects, delete the wrapper components after confirming nothing else mounts them

## Workspace shell pattern

Reuse the existing `ComplianceHubTabs` pattern. Build one `<WorkspaceShell>` component:

```text
┌─ Workspace Title ──────────── Filters · Search · New ─┐
│  [Tab A]  [Tab B]  [Tab C]  [Tab D]                    │
├────────────────────────────────────────────────────────┤
│  Active tab content (lazy-loaded existing page)        │
└────────────────────────────────────────────────────────┘
```

- Tab state synced to `?view=…` so links and back/forward work.
- Each tab lazy-imports the original page component — zero rewrites of business logic.
- Filter chips (org/entity/lifecycle/search) live in the shell and pass through context, so switching tabs preserves filter state.

## Sidebar rewrite (`navConfig.ts`)

```text
Portfolio
  Today
  Dashboard
  Properties
  Entities

Operations
  Compliance
  Lettings
  Contractors
  Inspections
  Documents
  Inbox

Intelligence
  Insights
  Reports

Admin
  Settings
```

12 destinations. Children removed from sidebar (they live as in-page tabs). Mobile bottom nav shrinks to 5 (Today, Properties, Compliance, Lettings, More).

## Technical sections

- **`navConfig.ts`**: rewrite to the 12-item tree. Drop `children`.
- **`App.tsx`**: add the redirects above using `<Navigate to=… replace />`. Keep all `Route` entries for detail pages (`/properties-v2/:id`, `/tenants-v2/:id`, etc.) — only collection routes redirect.
- **New `src/components/layout/WorkspaceShell.tsx`**: tab strip + URL sync + filter passthrough. Models after `ComplianceHubTabs`.
- **New workspace pages** that compose existing page components into tabs:
    - `src/pages/Today.tsx` — add tabs (Today / Fix-it / Missing info / Data quality / Actions)
    - `src/pages/Lettings.tsx` — new file, tabs into existing TenantsV2/RentCollection/Voids/LettingsPipeline
    - `src/pages/Finance.tsx` — new file, tabs into Financials/Lending/Refinancing/Investors/Distributions/Insurance/Accounting/Tax/TaxDashboard/FinancialForecast
    - `src/pages/Contractors.tsx` — already exists, extend with tabs for JobsAndWorks + CapEx
    - `src/pages/Documents.tsx` — extend with tabs for Templates + BulkUpload + BulkDocumentScanner
    - `src/pages/Insights.tsx` — rebuild as tabs over Timeline + PortfolioTimeline + ValuationAlerts + Chat + AIInvestorReports + AcquisitionAdvisor
    - `src/pages/Settings.tsx` — add sub-sections for Team / Import / Audit Log / Webhooks / System Health / Migration
- **`MobileBottomNav.tsx`**: reduce to 5 items, "More" drawer reads from flattened nav.
- **Search / command palette** (`GlobalSearch`): regenerate index from new flat nav so jump-to-page still works for the absorbed routes (e.g. typing "refinancing" still finds it).
- **Tests**: update `e2e/navigation.spec.ts` and any route guard tests that hit the redirected URLs.
- **Sitemap** (`public/sitemap.xml`): drop redirected internal URLs, keep canonical workspace URLs.

## What I'm explicitly not touching

- Any DB tables, RLS, edge functions, or business logic.
- Detail routes (`/properties-v2/:id`, `/tenants-v2/:id`, `/jobs/:id`, etc.) — URLs unchanged.
- Marketing site, portal, tenant-portal — separate surface, untouched.
- Admin / platform-admin routes — untouched.

## Out of scope (intentionally)

- Visual restyle of the workspace shell beyond reusing the existing Compliance Hub tab styling.
- New filters or new analytics — only relocation.
- Killing routes that have telemetry showing real usage; if anything in the redirect list is actually well-used I'd rather keep it and just demote it from the sidebar. If you want, before I build I can run a quick usage check from Sentry / analytics to validate the kill-list.

## Rollout

One PR. Behind a feature flag (`flags.consolidated_nav`) so we can flip back in seconds if a user reports a missing path. Flag default ON in preview, OFF in prod for the first 24h, then ON.

## What I need from you

1. **OK to redirect (not delete) the routes above?** That's the safe path — bookmarks keep working.
2. **Any route in the redirect list that you know is heavily used and should stay as a top-level sidebar item?** Likely candidates people push back on: Rent Collection, Lending, Tax — easy to promote back if so.
3. **Keep `Inbox` as a top-level item, or fold under Compliance Hub?** I have it standalone above; arguable either way.