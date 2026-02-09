# HydrogenCap — Professional Improvement Plan

## Perspective

This review is written from the standpoint of a chartered surveyor and head of UX at a residential and HMO investment fund. It assesses HydrogenCap as a working tool that a portfolio manager, fund analyst, or operations director would actually rely on daily — and identifies the gaps between where it is now and where it needs to be to become indispensable.

The app already covers impressive ground: 83k lines, 75 database tables, compliance requirement engine, AI autofill, ownership attribution, edge functions for EPC/price-paid enrichment, and a shareholder portal. That's a serious foundation. What follows is a plan to turn it from a capable prototype into a tool that fund managers and HMO operators would pay for and trust.

---

## PART 1 — NAVIGATION & INFORMATION ARCHITECTURE

### Problem: The sidebar has 19 items with no hierarchy

The current navigation lists Dashboard, Portfolio, Actions, Pipeline, Timeline, Refinance, Companies, Contractors, Jobs, Passport, Missing Info, Chat, Insights, Reports, Settings — plus a Compliance sub-menu with Register, Inbox, Calendar. There are also Tenants, Rent, and Maintenance pages accessible via routes but not prominently linked.

A portfolio manager managing 50+ properties doesn't think in terms of "Passport" or "Missing Info" — they think in workflows: "What's expiring?", "Where am I losing money?", "What does my lender need?"

### Recommended restructure

Group the sidebar into four clear sections that mirror how a fund actually operates:

**Portfolio** (the assets)
- Dashboard (home — the morning briefing)
- Properties (list + map)
- Pipeline (development tracker)
- Companies & Ownership

**Operations** (the day-to-day)
- Compliance (register + inbox + calendar unified)
- Tenants & Rent (merge tenant list, rent collection, maintenance into one section)
- Contractors & Jobs (already well-linked, keep together)
- Insurance (currently only accessible from property detail — promote it)

**Intelligence** (the decisions)
- Actions Required (the single most valuable screen)
- Insights & Reports (merge — they serve the same purpose)
- Refinance Calendar
- Chat / AI Advisor

**Admin**
- Settings
- Import / Passport data

This reduces cognitive load from 19 top-level items to 4 groups with clear purpose. The "Missing Info" and "Passport" pages become sub-features within the property detail or a data quality section in Settings, not top-level navigation.

---

## PART 2 — DOMAIN GAPS (What a chartered surveyor would expect)

### 2A. Leasehold management is incomplete

The database has `lease_years_remaining` and the property form captures it, but there's no active tracking or alerting for:

- **Lease deterioration warnings** — Properties below 80 years should flag amber, below 60 years should flag red. This directly impacts mortgage availability and valuation.
- **Ground rent and service charge tracking** — The document inbox can classify these but there's no structured data or annual tracking. For leasehold portfolios this is a critical cost line.
- **Section 20 notice tracking** — Major works on leasehold properties require Section 20 consultation. No concept exists in the system.
- **Lease extension pipeline** — When you have 15 leaseholds and 4 need extending, you need a tracker with solicitor, surveyor, timeline, and cost estimate.

**Suggested implementation:** Add a `leasehold_details` table with ground_rent, service_charge_annual, managing_agent, lease_start_date, original_term_years, next_review_date. Create a "Leasehold Health" widget on Dashboard showing properties approaching the 80-year threshold. Add lease_length as a risk type in the Actions page.

### 2B. No void period tracking or cost modelling

The property has an `occupancy_status` field with Occupied/Void/In Works, but there's no historical record. When a property goes void, the system doesn't capture:

- Void start/end dates
- Void cost (mortgage still running, council tax liability, insurance changes)
- Average void period per property (critical for yield calculations)
- Void rate across the portfolio

A real fund tracks void periods religiously because every week void costs money. Current yield calculations assume continuous occupation which overstates returns.

**Suggested implementation:** Add a `void_periods` table (property_id, start_date, end_date, reason, estimated_cost). Automatically create a void period when occupancy_status changes. Show void rate on Dashboard and factor void assumptions into cashflow projections.

### 2C. Tenancy compliance is dangerously thin

The database has deposit fields (scheme, reference, protected_date) on tenancies — good. But the system doesn't track or alert on any of the legally required tenancy compliance that can invalidate a Section 21 notice:

- **How to Rent guide** — Must be provided to every tenant. Date served needs recording.
- **Prescribed information** — Deposit prescribed info must be served within 30 days. No tracking.
- **Gas Safety Certificate to tenant** — Must be provided before move-in AND annually. This is separate from just having the certificate.
- **EPC to tenant** — Must be provided before tenancy starts.
- **Right to Rent check** — Immigration check required before tenancy. No concept in system.
- **Tenancy deposit protection deadline** — 30 days from receipt. Should auto-alert.

Missing any of these means you cannot legally evict a tenant. For an HMO fund, this is existential risk.

**Suggested implementation:** Add a `tenancy_compliance_checklist` that auto-generates when a tenancy is created, with the required items pre-populated. Each item has a date_completed and document_id. Show a compliance score per tenancy on the Tenant Detail page. Flag non-compliant tenancies on the Actions page.

### 2D. HMO-specific features are underdeveloped

The system knows if a property is an HMO and tracks the HMO licence, but an HMO operator needs:

- **Room-level data** — The `rooms` table exists but isn't prominently surfaced. Each room needs: dimensions (minimum 6.51m² single, 10.22m² double per Housing Act), rent amount, occupant, fire door status, lock status, window size.
- **Amenity ratio tracking** — Councils require specific ratios of bathrooms/kitchens to occupants. Currently unchecked.
- **HMO licence conditions** — Each licence comes with conditions. These need tracking per property.
- **Maximum occupancy** — Per room and per property. Critical for licence compliance.
- **Fire safety plan per property** — Fire escape routes, assembly points, fire door schedule, alarm zones.

**Suggested implementation:** Promote the room register to a first-class feature within Property Detail. Add room_min_size validation that checks against Housing Act minimums. Create an HMO Compliance Summary card that shows licence conditions, amenity ratios, and room size compliance at a glance.

### 2E. No capital expenditure or works tracking

The Pipeline page mentions "Projected GDV" and development properties exist as a lifecycle type, but there's no structured capex/works tracking:

- **Works budget vs actual** — No way to track spend on a refurbishment against budget
- **Contractor payment schedule** — Jobs exist but aren't linked to cost tracking
- **Development appraisal** — No GDV/build cost/profit calculation
- **Post-completion reconciliation** — Compare projected vs actual returns

For a fund running development projects alongside core rental, this is a core workflow.

**Suggested implementation:** Add a `project_costs` table linked to properties, with budget_category (acquisition, legal, stamp_duty, build, professional_fees, finance, contingency), budgeted_amount, actual_amount, date_incurred. Create a development appraisal calculator (GDV - total costs = profit, profit/total costs = profit on cost %). Link contractor job costs into the project tracker.

---

## PART 3 — UX & WORKFLOW IMPROVEMENTS

### 3A. The Dashboard tries to show everything — it should show what matters today

929 lines, 15 useMemo blocks, scrolling through: KPIs → Missing Info alert → This Month → Portfolio Health → Actions → Map → Lender Exposure → Area Exposure → Data Quality → Beneficial Owners → Stock Condition → Missing Compliance → Upcoming Expirations → Recent Activity.

Nobody reads all of that. A portfolio manager opens the dashboard at 8am and needs three things:

1. **What needs my attention right now?** (expired certs, overdue rent, expiring rates)
2. **How is the portfolio performing?** (equity, cashflow, yield)
3. **What's coming up this week/month?** (renewals, inspections, refinances)

Everything else is "drill-down" content.

**Recommended redesign:**

The dashboard should have three clear zones:

**Zone 1 — "Today" strip** (always visible, max 1 row)
- Critical action count with one-click to Actions page
- Next expiring certificate (name + days)
- Next rent due (amount + date)
- Mortgage rate expiring soonest

**Zone 2 — KPI cards** (keep the existing 4, they're good)
- Attributable Equity, Monthly Cashflow, Average LTV, Actions Required

**Zone 3 — Tabbed detail** (user chooses what to look at)
- "This Month" tab (the existing ThisMonthWidget — make it the default)
- "Health" tab (Portfolio Health + Missing Compliance + Data Quality)
- "Map" tab (the property map, full width)
- "Finance" tab (Lender Exposure + Area Exposure + Shareholder breakdown)
- "Activity" tab (Recent Activity + Upcoming Expirations)

Move StockConditionSection, BeneficialOwnerWidget, and DataQualityWidget into the Health tab. They're useful but secondary.

### 3B. Property Detail needs a "status bar" not just KPI cards

The property detail page shows Equity, LTV, Cashflow, Yield as four cards at the top. Good metrics, but a surveyor also needs to see at a glance:

- **Compliance status** — green/amber/red dot showing overall compliance health
- **Tenancy status** — occupied/void + current tenant name + lease end date
- **Next action** — the single most urgent thing on this property (e.g. "Gas cert expires in 12 days")
- **Data quality** — passport completeness %

This should be a compact, single-row "status bar" between the header and the KPI cards. Think of it as the traffic-light summary that lets you assess a property in 2 seconds without scrolling.

### 3C. Actions page needs "resolve" workflow, not just a list

The Actions page is a well-structured risk table with filtering and sorting. But it's read-only — you see the problems but can't do anything about them from there. Each action should have:

- **Resolve button** → Opens context-appropriate dialog (upload cert, record payment, assign to contractor)
- **Snooze/dismiss** → "I know about this, remind me in 30 days" with a reason
- **Assign** → Tag a team member or contractor
- **History** → When was this first flagged? Has it been snoozed before?

Without this, the Actions page is just a worry list. With it, it becomes the operational nerve centre.

### 3D. Compliance Register needs a "per property" summary view

The compliance register currently shows all items across all properties in a flat list. Useful for portfolio-wide compliance officers, but most users think property-first: "Is 14 Oak Street compliant?"

Add a toggle that groups compliance items by property, showing a compliance score per property with expandable detail. This is the view that a council inspector or mortgage surveyor would want to see.

### 3E. The Tenants, Rent Collection, and Maintenance pages should be one section

These three pages are conceptually one workflow: managing the occupational side of the portfolio. Currently:

- Tenants page has a TODO for "Add Tenant" dialog
- Rent Collection has a TODO for "Record Payment" dialog
- Maintenance has a TODO for "Create maintenance request" dialog

All three lack their core action. They should be combined into a single "Lettings" or "Tenancy Management" section with tabs, and the missing dialogs should be the highest priority.

### 3F. Reports page should have one-click "lender pack" and "annual review"

The Bank Presentation dialog exists on the Dashboard but not on Reports. A fund manager preparing for a quarterly lender review should be able to go to Reports and generate:

- **Lender Pack** — Property schedule, compliance summary, rent roll, LTV analysis
- **Annual Review** — Year-on-year performance comparison per property
- **Compliance Certificate Pack** — All certificates for a property in one PDF
- **Tenant Schedule** — Current rent roll with tenant details and lease end dates

The existing report generation hook supports templates — these should be pre-configured and prominent.

---

## PART 4 — DATA INTEGRITY & INTELLIGENCE

### 4A. Yield calculations should distinguish gross/net/true

The system currently calculates yield as `netRent / currentValue`. But fund reporting typically requires three yield figures:

- **Gross yield** = Annual rent / Current value
- **Net yield** = (Annual rent - operating costs) / Current value  
- **Cash-on-cash return** = Annual cashflow after debt / Equity invested (i.e. deposit + stamp duty + refurb)

The current "Net Yield" label is correct, but Cash-on-Cash (ROCE) is the figure investors actually care about because it measures return on their own money, not the bank's.

Make ROCE more prominent. Show all three yields on Property Detail. On Dashboard, lead with cash-on-cash.

### 4B. Portfolio stress testing

A lender or investor will ask: "What happens to your portfolio if rates go up 2%?" or "What if values drop 15%?"

Add a simple stress test tool (can be part of Insights) that recalculates:
- Cashflow at +1%, +2%, +3% rate increase
- LTV at -10%, -15%, -20% value decline
- Combined scenario: rates up 2% AND values down 15%

This is straightforward maths using existing data and would be a huge differentiator.

### 4C. Insurance gap analysis

The insurance hook exists and is well-built, but the PropertyMap has `hasMissingInsurance = false // TODO`. Insurance should be a first-class compliance item:

- Flag properties with no active insurance policy
- Flag policies expiring within 30 days
- Check buildings cover matches or exceeds reinstatement value
- Check rent guarantee insurance is in place for HMOs
- Show total annual insurance cost on Dashboard

### 4D. Document management needs structure

The inbox processes uploaded documents well (AI extraction, naming, filing), but there's no concept of a "property document pack" — the complete set of documents a property should have:

- Title deeds / Land Registry entry
- Most recent valuation
- Current tenancy agreement
- All compliance certificates
- Insurance schedule
- Mortgage offer
- Company confirmation statement (if SPV-owned)

Create a "Document Checklist" per property that shows which documents are present and which are missing. This is the first thing a solicitor or lender asks for.

---

## PART 5 — IMPLEMENTATION PRIORITY

### Phase 1 — Fix what's broken (1-2 weeks)

1. **Complete the TODO dialogs** — Add Tenant, Record Payment, Create Maintenance Request. These are accessible pages with non-functional buttons. Users will bounce.
2. **Implement the Actions resolve workflow** — Add "Upload Certificate" and "Assign to Contractor" actions from the risk table.
3. **Dashboard simplification** — Restructure into the 3-zone layout. Remove scroll fatigue.
4. **Sidebar reorganisation** — Group into Portfolio / Operations / Intelligence / Admin.

### Phase 2 — Fill domain gaps (3-4 weeks)

5. **Tenancy compliance checklist** — Auto-generated per tenancy with legal requirements. This is the highest-risk gap.
6. **Void period tracking** — Start/end dates, cost impact, portfolio void rate.
7. **Leasehold health monitoring** — Lease length warnings, ground rent tracking.
8. **Insurance gap analysis** — Surface the existing insurance data as compliance items.
9. **HMO room compliance** — Minimum room sizes, amenity ratios, licence conditions.

### Phase 3 — Intelligence layer (4-6 weeks)

10. **Portfolio stress testing** — Rate and value scenario modelling.
11. **Property document checklist** — Structured document completeness per property.
12. **Enhanced reporting** — Lender pack, compliance certificate pack, tenant schedule.
13. **Cash-on-cash / ROCE as primary return metric** — Track equity invested (deposit + costs) per property.
14. **Capex/works tracker** — Budget vs actual for development properties.

### Phase 4 — Scale & polish (ongoing)

15. **Merge Tenants + Rent + Maintenance** into unified Lettings section.
16. **Per-property compliance summary view** on the register.
17. **Quarterly review automation** — Scheduled report comparing this quarter to last.
18. **Audit trail** — Who changed what, when (the activity log exists but isn't comprehensive).
19. **Mobile responsiveness audit** — Several pages (Properties table, Dashboard charts) will be cramped on mobile.

---

## CLOSING NOTE

HydrogenCap has built the hard things well: the ownership attribution model, the compliance requirements engine, the AI document processing pipeline, and the financial calculations. The gaps are primarily in the operational day-to-day features that a working fund relies on, and in the UX flow that makes the difference between "I should check the app" and "I can't work without the app."

The single highest-impact change would be completing the tenancy management workflow (Phase 1, items 1-2) and adding the tenancy compliance checklist (Phase 2, item 5). Together, these transform HydrogenCap from a portfolio analytics tool into an operational management platform — which is where the recurring revenue lives.
