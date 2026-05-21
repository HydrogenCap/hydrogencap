## What the data says

I pulled live signals from your org before writing this:

- **27 properties**, but only **13 active tenancy agreements** across **12 properties** → 15 effectively vacant / untracked.
- **26 of 27 properties** have no `whole_house_rent_pcm`. Rent is held on tenancy agreements, so any KPI/widget reading the property column is wrong by default.
- **98 compliance gaps** in `compliance_matrix_v2`: 80 missing, 12 expired, 6 critical, 15 expiring — concentrated across only 27 assets.
- **Doc AI pipeline**: of ~242 processed documents, **58 failed** (~24%). **16 are still stuck** as `failed + pending` with no recovery happening.
- **2 loan facilities** have rate expiry within 180 days — a refinancing window with no visible nudge.
- **`errors_log`** (just created) has zero entries — nothing is writing to it yet.

That gives a real "next 6" — each tied to a measurable gap, not a generic wishlist.

## The Plan

### 1. Fix the rent KPI at source (highest impact, smallest blast radius)
Right now the dashboard / property cards read `properties_v2.whole_house_rent_pcm`, which is null on 26/27 assets. The actual rent lives on `tenancy_agreements`. Build one shared `usePropertyRent(propertyId)` hook that:
- Reads the property's active tenancy agreement first.
- Falls back to `whole_house_rent_pcm`, then to sum of room-level rents (HMOs).
- Returns `{ pcm, source: 'tenancy' | 'property' | 'rooms' | 'none' }` so UI can show provenance.
Then swap call sites: property card, dashboard rent KPI, portfolio totals.

### 2. Compliance Action Centre
80 missing + 12 expired + 6 critical across 27 properties is a lot of noise but a *finite* worklist. Build `/compliance-actions` (or a tab on `/compliance-v2`) that:
- Lists every gap from `compliance_matrix_v2` where `calculated_status ∈ (missing, expired, critical, expiring_soon)`.
- Groups by severity → property → certificate type.
- Each row has one-click actions: **Upload now** (opens inbox prefilled), **Mark not applicable**, **Snooze 7d**.
- Sort by overdue days desc so the worst rises to the top.

### 3. Doc pipeline reliability — kill the 16 stuck docs and stop the bleed
- **Recovery sweep**: a small "Stuck for >24h" group in the Inbox Analysing tab with a one-click **Retry all** (we already have per-doc retry; wrap it).
- **Wire `logError()`** into the AI extraction edge function (`extract-compliance-document` or equivalent) so the 24% failure rate becomes attributable — model timeouts vs. corrupt PDFs vs. classification failures.
- Add a **"Why did this fail?"** disclosure on failed cards reading `extraction_error` (already in DB) — currently surfaced only as a generic toast.

### 4. Refinancing radar
2 loans expire within 180 days. Today the user only sees that on the (deep) `/refinancing-opportunities` page. Add a **dashboard banner** when any loan has a rate expiry within the next 6 months, linking through. Also add the count to the sidebar Lending badge.

### 5. Adopt `usePropertyComplianceStatus` (the hook I shipped last turn but nothing uses yet)
Swap any ad-hoc compliance bucketing in:
- `PropertyStatusBar.tsx`
- `EntityPortfolioSummaryCard.tsx`
- Property-card compliance badge (currently inconsistent across grid vs. detail)
…over to the shared hook. Removes drift between surfaces and proves the abstraction.

### 6. System Health page (cash in on `errors_log`)
Tiny `/system-health` page (Settings nav) showing:
- Errors in last 7 days grouped by `source`, with severity badges.
- Doc pipeline success rate (computed live from `documents`).
- Stuck-doc count.
- "Mark resolved" action per error.
Gives both you and the user one place to see if anything is silently breaking.

## Suggested order
1, 3, 4 first — they're each ≤1 file/migration and directly fix things users see this week. Then 2, 5, 6 (2 is the biggest UI build).

## Out of scope (deliberately)
- Performance work — last batch already covered cold-start.
- Auth/session — already centralised.
- Marketing site / SEO — no signal it's broken.

Want me to start on **1, 3, 4** (the quick high-impact set) or pick differently?
