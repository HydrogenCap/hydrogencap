# AB2: Investor Portal V2 Migration + Distribution Statements

The investor portal exists (`src/pages/portal/PortalDashboard.tsx`, 373 lines) with KPIs, per-property breakdown, and permission-gated financials. However, it queries V1 tables (`properties`, `loans`, `income`, `costs`) and lacks distribution tracking. Migrate to V2 and add quarterly distribution statements.

## Migrate Portal Data Hooks to V2

In `src/hooks/useShareholderPortfolioData.ts`:

1. Change all V1 table references:
   - `properties` → `properties_v2` (field mapping: `current_value_gbp` → `current_valuation`, `beds` → `total_lettable_rooms`, `is_hmo_licensed` → check `property_type` contains 'hmo')
   - `loans` → `loan_facilities` (field mapping: `current_mortgage_balance_gbp` → `current_balance`, `mortgage_payment_gbp` → `monthly_payment`)
   - `income` / `costs` tables → derive from `rent_payments` and `maintenance_requests` + `loan_facilities`

2. Update `PortalDashboard.tsx` to use V2 field names in all calculations and display

3. Update the `PortalProperty` interface to match V2 schema

## New Table: `distributions`

Track quarterly profit distributions to shareholders:

```sql
CREATE TABLE distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  entity_id UUID NOT NULL REFERENCES legal_entities(id),
  period_label TEXT NOT NULL, -- 'Q1 2025', 'Q2 2025'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_rental_income NUMERIC NOT NULL DEFAULT 0,
  total_expenses NUMERIC NOT NULL DEFAULT 0,
  total_mortgage_costs NUMERIC NOT NULL DEFAULT 0,
  net_distributable NUMERIC NOT NULL DEFAULT 0, -- income - expenses - mortgage
  total_distributed NUMERIC NOT NULL DEFAULT 0,
  retained_earnings NUMERIC NOT NULL DEFAULT 0, -- net_distributable - total_distributed
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'approved' | 'distributed'
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE distribution_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL REFERENCES distributions(id) ON DELETE CASCADE,
  shareholder_id UUID NOT NULL REFERENCES shareholders(id),
  shareholder_name TEXT NOT NULL,
  ownership_percent NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage distributions"
  ON distributions FOR ALL
  USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));

CREATE POLICY "Org members manage allocations"
  ON distribution_allocations FOR ALL
  USING (distribution_id IN (SELECT id FROM distributions WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())));
```

## Distribution Management Page

Create `src/pages/Distributions.tsx` with route `/distributions`:

### Create Distribution Flow

Button: "Create Quarterly Distribution"

Opens a dialog/sheet:
1. Select entity (from `legal_entities`)
2. Select period (auto-suggests next quarter)
3. System auto-calculates:
   - Rental income: sum of `rent_payments` for the period for properties owned by this entity
   - Expenses: sum of `maintenance_requests.actual_cost` + `tax_expenses` for the period
   - Mortgage costs: sum of `loan_facilities.monthly_payment × months` for the period
   - Net distributable: income - expenses - mortgage
4. Enter distribution amount (defaults to net distributable, can be less for retained earnings)
5. Auto-allocates to shareholders based on ownership percentages
6. Review allocation table: shareholder name, %, amount
7. Save as draft or approve

### Distribution History Table

| Period | Entity | Income | Expenses | Net | Distributed | Status | Actions |
|--------|--------|--------|----------|-----|-------------|--------|---------|

- Click to expand and see per-shareholder allocations
- "Approve" button on drafts
- "Mark Paid" per allocation (sets `paid_at`)
- "Generate Statement PDF" per distribution

### Distribution Statement PDF

Using jsPDF (same pattern as existing reports):
- Header: entity name, period, date
- Income summary: total rent by property
- Expense summary: maintenance, mortgage, other
- Net distributable calculation
- Allocation table: shareholder, %, amount
- Payment status and reference

## Portal Enhancement

On `PortalDashboard.tsx`, add a "Distributions" tab/section (only visible to shareholders with financial access):

- Last 4 quarters of distributions for entities they have a stake in
- Their allocation amount per quarter
- Running total of distributions received
- "Download Statement" link per distribution

## Sidebar

Add "Distributions" to the Portfolio group, using the `Banknote` icon. Only visible for Portfolio/Pro tier subscribers.

## Do NOT

- Do NOT rebuild the existing portal dashboard — just migrate its data queries to V2
- Do NOT change the shareholder access/invite system — it works
- Do NOT build bank payment integration — just track that distributions were paid
- Do NOT calculate corporation tax in this prompt — that's in AB1
