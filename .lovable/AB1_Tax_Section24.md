# AB1: Tax & Section 24 Calculation Engine

Build a UK property tax calculator that generates SA105 data, calculates Section 24 mortgage interest relief, and produces an annual tax summary per property and per entity. This is the #1 feature landlords ask accountants for — saving £500+ per portfolio per year.

## Tax Calculation Library

Create `src/lib/propertyTax.ts`:

### SA105 Property Income Data

For each property, calculate the annual figures that go on HMRC's SA105 form:

```typescript
interface SA105PropertyData {
  propertyAddress: string;
  // Box 20: Total rents and other income
  totalRentalIncome: number; // sum of rent_payments for the tax year
  // Box 24: Property income allowance (£1,000) OR actual expenses
  usePropertyAllowance: boolean;
  // Box 25-26: Premiums paid
  premiumsReceived: number;
  // Allowable expenses breakdown:
  repairs: number; // maintenance_requests.actual_cost (completed, not capital)
  insurance: number; // from compliance_documents_v2 costs or manual entry
  managementFees: number;
  accountingFees: number;
  groundRent: number;
  serviceCharges: number;
  otherAllowableExpenses: number;
  totalAllowableExpenses: number;
  // Box 44: Residential finance costs (Section 24)
  residentialFinanceCosts: number; // total mortgage interest paid
  // Calculated
  adjustedProfit: number; // income - expenses (before Section 24 relief)
  taxCreditAt20Percent: number; // residentialFinanceCosts × 20%
}
```

### Section 24 Calculator

```typescript
interface Section24Calculation {
  totalMortgageInterest: number; // annual interest from loan_facilities
  taxReliefAt20Percent: number; // interest × 20%
  // For higher-rate taxpayers:
  taxSavedVsOldRules: number; // what they'd save under pre-2020 rules
  additionalTaxDueToS24: number; // the S24 penalty
  effectiveTaxRate: number; // actual tax as % of rental profit
}

export function calculateSection24(
  annualMortgageInterest: number,
  taxableProfit: number,
  marginalTaxRate: 0.20 | 0.40 | 0.45 // basic, higher, additional
): Section24Calculation {
  // Under old rules: interest deducted from income (saves at marginal rate)
  // Under Section 24: 20% tax credit only
  // Difference = interest × (marginalRate - 0.20)
}
```

### Annual Tax Summary

```typescript
interface AnnualTaxSummary {
  taxYear: string; // "2024/25"
  properties: SA105PropertyData[];
  totalRentalIncome: number;
  totalAllowableExpenses: number;
  totalResidentialFinanceCosts: number;
  netPropertyIncome: number; // before S24 adjustment
  section24TaxCredit: number;
  estimatedTaxLiability: number; // at user's marginal rate
  perEntityBreakdown: {
    entityName: string;
    entityType: string;
    properties: SA105PropertyData[];
    totalProfit: number;
    // SPVs pay corporation tax, personal pays income tax
    applicableTaxRate: number;
    estimatedTax: number;
  }[];
}
```

## Tax Settings

Add user-configurable tax settings. Create or extend a settings section:

Add columns to `profiles` (or use a `tax_settings` table):

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marginal_tax_rate NUMERIC DEFAULT 0.40;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS corporation_tax_rate NUMERIC DEFAULT 0.25;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS use_property_allowance BOOLEAN DEFAULT false;
```

## Tax Dashboard Page

Create `src/pages/Tax.tsx` with route `/tax` (lazy-loaded, protected):

### Tax Year Selector

Dropdown at top: "2024/25", "2023/24", "2022/23". Defaults to current tax year (April 6 to April 5).

### Summary KPI Row

- **Total Rental Income** — sum across all properties for the selected year
- **Total Expenses** — allowable deductions
- **Net Taxable Profit** — income minus expenses
- **Estimated Tax** — based on user's marginal rate (personal) or corp tax rate (SPV)

### Section 24 Impact Card

For personal properties only (not SPVs — they deduct interest normally):

```
┌──────────────────────────────────────────────────────┐
│ ⚠️ Section 24 Impact                                 │
│                                                      │
│ Total mortgage interest:     £12,480                 │
│ Tax credit (20%):            -£2,496                 │
│                                                      │
│ If you were basic rate:      No additional cost      │
│ As a higher rate taxpayer:   £2,496 extra tax/year   │
│                                                      │
│ 💡 Consider: Moving properties into an SPV could     │
│    save £2,496/year in tax.                          │
└──────────────────────────────────────────────────────┘
```

### Per-Property Breakdown Table

| Property | Income | Expenses | Interest | Profit | Tax | Entity |
|----------|--------|----------|----------|--------|-----|--------|
| 14 High St | £32,700 | £4,200 | £8,120 | £28,500 | — | SPV |
| 8 Oak Rd | £14,400 | £1,800 | £10,953 | £12,600 | £2,520 | Personal |

- SPV properties show corporation tax calculation
- Personal properties show income tax + Section 24 credit
- Click a row to expand and see the full SA105 breakdown

### Per-Entity Summary

Group properties by entity:

```
Cheltenham Properties Ltd (SPV)
  2 properties, £47,100 income, £38,900 profit
  Corporation tax (25%): £9,725

Personal
  1 property, £14,400 income, £12,600 profit
  Income tax (40%): £5,040
  Section 24 credit: -£2,191
  Net tax: £2,849
```

### Export Options

- **Export SA105 data** — CSV file with all fields matching the SA105 form, ready to give to an accountant
- **Export Tax Summary PDF** — formatted PDF with the annual breakdown (use jsPDF, same pattern as existing report generators)

## Data Sources

The tax engine pulls from existing tables — no new data entry required:

- **Rental income**: `rent_payments` for the tax year (sum `amount_paid`)
- **Mortgage interest**: `loan_facilities` — calculate annual interest from `current_balance × interest_rate` or `monthly_payment × 12 - principal_repayment`
- **Repairs**: `maintenance_requests` where `status = 'completed'` and `actual_cost > 0`
- **Insurance**: manual entry or from `compliance_documents_v2` where document_type contains 'insurance'
- **Entity type**: `legal_entities.entity_type` determines personal vs SPV tax treatment

### Manual Expense Entry

Some expenses aren't tracked elsewhere (accountant fees, ground rent, management fees). Add a simple expense entry section:

Create `tax_expenses` table:

```sql
CREATE TABLE tax_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  property_id UUID NOT NULL REFERENCES properties_v2(id),
  tax_year TEXT NOT NULL, -- '2024/25'
  category TEXT NOT NULL, -- 'insurance' | 'management_fees' | 'accountancy' | 'ground_rent' | 'service_charges' | 'travel' | 'other'
  description TEXT,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

On the tax page, show an "Add expense" button per property that opens a form for these manual entries.

## Sidebar

Add "Tax" to the Intelligence group in the sidebar, using the `Receipt` icon from lucide-react.

## Do NOT

- Do NOT build direct HMRC integration or submission
- Do NOT calculate capital gains tax — that's a separate feature
- Do NOT provide tax advice — add a disclaimer: "This is an estimate only. Consult a qualified accountant for tax advice."
- Do NOT duplicate the P&L calculations from AA3a — reference the same data sources but with tax-year date ranges
