# HydrogenCap — NEXT Phase 2.7: Accounting Export

## Context

HydrogenCap now tracks rent collection, maintenance costs, compliance spend, loan payments, and distributions. All of this financial data lives in the system — but it also needs to reach the accountant. Every SPV needs annual accounts filed at Companies House. Every landlord needs a self-assessment tax return. Every investor needs tax certificates.

Accountants do not want to log into your property management tool. They want a CSV or an accounting system integration. The most common UK small business accounting platforms are Xero, QuickBooks, and FreeAgent. Sage is used by larger firms. At a minimum, HydrogenCap must export financial data in formats these tools can import.

Direct API integration with Xero or QuickBooks is ideal but complex (OAuth2 flows, token management, webhook handling). For this phase, we build robust CSV/Excel export in accounting-compatible formats, plus a data mapping layer that can be extended to API integrations later. This gets data to the accountant immediately while the infrastructure supports future live sync.

## Database Tables

### `accounting_mappings`

Map HydrogenCap financial categories to accounting system chart of accounts codes:

```sql
create table public.accounting_mappings (
  id uuid primary key default gen_random_uuid(),
  accounting_system text not null check (accounting_system in ('xero', 'quickbooks', 'freeagent', 'sage', 'generic')),
  entity_id uuid references public.legal_entities(id),
  hydrogencap_category text not null,
  account_code text not null,
  account_name text not null,
  tax_rate_code text,
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(accounting_system, entity_id, hydrogencap_category)
);

create index idx_accounting_mappings_system on public.accounting_mappings(accounting_system);
create index idx_accounting_mappings_entity on public.accounting_mappings(entity_id);
```

### `accounting_exports`

Log every export for audit trail and re-download:

```sql
create table public.accounting_exports (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references public.legal_entities(id),
  export_type text not null check (export_type in ('income_transactions', 'expense_transactions', 'combined_journal', 'bank_reconciliation', 'rent_schedule', 'trial_balance', 'tax_summary', 'full_package')),
  accounting_system text not null,
  period_from date not null,
  period_to date not null,
  file_url text,
  file_name text,
  file_format text not null check (file_format in ('csv', 'xlsx', 'json', 'qif', 'ofx')),
  row_count integer,
  total_income numeric(12,2),
  total_expenses numeric(12,2),
  generated_by uuid,
  generated_at timestamptz default now(),
  notes text
);

create index idx_accounting_exports_entity on public.accounting_exports(entity_id);
create index idx_accounting_exports_period on public.accounting_exports(period_from, period_to);
```

### `tax_year_summaries`

Pre-calculated tax year summaries per entity for quick export:

```sql
create table public.tax_year_summaries (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.legal_entities(id) on delete restrict,
  tax_year text not null,
  tax_year_start date not null,
  tax_year_end date not null,
  total_rental_income numeric(12,2) default 0,
  total_other_income numeric(12,2) default 0,
  total_mortgage_interest numeric(12,2) default 0,
  total_repairs_maintenance numeric(12,2) default 0,
  total_insurance numeric(12,2) default 0,
  total_management_fees numeric(12,2) default 0,
  total_professional_fees numeric(12,2) default 0,
  total_utilities numeric(12,2) default 0,
  total_council_tax numeric(12,2) default 0,
  total_licensing numeric(12,2) default 0,
  total_other_expenses numeric(12,2) default 0,
  total_allowable_expenses numeric(12,2) generated always as (
    total_repairs_maintenance + total_insurance + total_management_fees +
    total_professional_fees + total_utilities + total_council_tax +
    total_licensing + total_other_expenses
  ) stored,
  net_rental_profit numeric(12,2) generated always as (
    total_rental_income + total_other_income - (
      total_repairs_maintenance + total_insurance + total_management_fees +
      total_professional_fees + total_utilities + total_council_tax +
      total_licensing + total_other_expenses
    )
  ) stored,
  finance_costs numeric(12,2) default 0,
  basic_rate_tax_reduction numeric(12,2) generated always as (
    total_mortgage_interest * 0.20
  ) stored,
  is_locked boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(entity_id, tax_year)
);

create index idx_tax_year_entity on public.tax_year_summaries(entity_id);
create index idx_tax_year_year on public.tax_year_summaries(tax_year);
```

If generated columns cause issues, use a trigger as with previous tables.

Note on mortgage interest: since April 2020, mortgage interest for individual landlords is not an allowable expense — it receives a basic rate tax reduction (20% credit) instead. For SPVs (companies), mortgage interest remains a deductible expense. The system should handle both cases based on entity_type: personal → tax reduction method, spv → full deduction.

### RLS Policies

```sql
alter table public.accounting_mappings enable row level security;
alter table public.accounting_exports enable row level security;
alter table public.tax_year_summaries enable row level security;

create policy "Authenticated access" on public.accounting_mappings for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated access" on public.accounting_exports for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated access" on public.tax_year_summaries for all using (auth.uid() is not null) with check (auth.uid() is not null);
```

### Audit Triggers

```sql
create trigger audit_accounting_mappings after insert or update or delete on public.accounting_mappings for each row execute function public.audit_trigger_function();
create trigger audit_tax_year_summaries after insert or update or delete on public.tax_year_summaries for each row execute function public.audit_trigger_function();
```

### Generate Tax Year Summary Function

```sql
create or replace function public.generate_tax_year_summary(
  target_entity_id uuid,
  target_tax_year text
)
returns uuid as $$
declare
  year_start date;
  year_end date;
  start_year integer;
  summary_id uuid;
begin
  -- Parse tax year (format: "2025/26")
  start_year := split_part(target_tax_year, '/', 1)::integer;
  year_start := (start_year || '-04-06')::date;
  year_end := ((start_year + 1) || '-04-05')::date;

  insert into public.tax_year_summaries (
    entity_id, tax_year, tax_year_start, tax_year_end,
    total_rental_income, total_other_income,
    total_mortgage_interest, total_repairs_maintenance,
    total_insurance, total_management_fees,
    total_professional_fees, total_utilities,
    total_council_tax, total_licensing,
    total_other_expenses, finance_costs
  )
  select
    target_entity_id,
    target_tax_year,
    year_start,
    year_end,
    coalesce(sum(fs.gross_rent_received), 0),
    coalesce(sum(fs.other_income), 0),
    coalesce(sum(fs.mortgage_payments), 0),
    coalesce(sum(fs.maintenance_costs), 0),
    coalesce(sum(fs.insurance_costs), 0),
    coalesce(sum(fs.management_fees), 0),
    coalesce(sum(fs.professional_fees), 0),
    coalesce(sum(fs.utilities), 0),
    coalesce(sum(fs.council_tax), 0),
    coalesce(sum(fs.licensing_costs), 0),
    coalesce(sum(fs.other_costs), 0),
    coalesce(sum(fs.mortgage_payments), 0)
  from public.financial_snapshots fs
  where fs.entity_id = target_entity_id
    and fs.snapshot_month >= year_start
    and fs.snapshot_month <= year_end
  on conflict (entity_id, tax_year) do update set
    total_rental_income = excluded.total_rental_income,
    total_other_income = excluded.total_other_income,
    total_mortgage_interest = excluded.total_mortgage_interest,
    total_repairs_maintenance = excluded.total_repairs_maintenance,
    total_insurance = excluded.total_insurance,
    total_management_fees = excluded.total_management_fees,
    total_professional_fees = excluded.total_professional_fees,
    total_utilities = excluded.total_utilities,
    total_council_tax = excluded.total_council_tax,
    total_licensing = excluded.total_licensing,
    total_other_expenses = excluded.total_other_expenses,
    finance_costs = excluded.finance_costs,
    updated_at = now()
  returning id into summary_id;

  return summary_id;
end;
$$ language plpgsql security definer;
```

### Default Accounting Mappings

Seed sensible defaults for Xero and QuickBooks:

```sql
-- Xero default mappings (generic, not entity-specific)
insert into public.accounting_mappings (accounting_system, hydrogencap_category, account_code, account_name, tax_rate_code) values
  ('xero', 'gross_rent_received', '200', 'Rental Income', 'NONE'),
  ('xero', 'other_income', '260', 'Other Revenue', 'NONE'),
  ('xero', 'management_fees', '400', 'Management Fees', 'INPUT2'),
  ('xero', 'maintenance_costs', '401', 'Repairs & Maintenance', 'INPUT2'),
  ('xero', 'insurance_costs', '402', 'Insurance', 'EXEMPTINPUT'),
  ('xero', 'mortgage_payments', '403', 'Finance Costs - Mortgage Interest', 'NONE'),
  ('xero', 'utilities', '404', 'Utilities', 'INPUT2'),
  ('xero', 'council_tax', '405', 'Council Tax', 'NONE'),
  ('xero', 'licensing_costs', '406', 'Licensing Costs', 'NONE'),
  ('xero', 'professional_fees', '407', 'Professional Fees', 'INPUT2'),
  ('xero', 'other_costs', '408', 'Sundry Expenses', 'INPUT2'),
  ('xero', 'void_loss', '409', 'Void Loss', 'NONE')
on conflict do nothing;

-- QuickBooks default mappings
insert into public.accounting_mappings (accounting_system, hydrogencap_category, account_code, account_name, tax_rate_code) values
  ('quickbooks', 'gross_rent_received', '4000', 'Rental Income', ''),
  ('quickbooks', 'other_income', '4100', 'Other Income', ''),
  ('quickbooks', 'management_fees', '5000', 'Property Management', '20.0% S'),
  ('quickbooks', 'maintenance_costs', '5010', 'Repairs & Maintenance', '20.0% S'),
  ('quickbooks', 'insurance_costs', '5020', 'Insurance', 'Exempt'),
  ('quickbooks', 'mortgage_payments', '5030', 'Mortgage Interest', 'No VAT'),
  ('quickbooks', 'utilities', '5040', 'Utilities', '20.0% S'),
  ('quickbooks', 'council_tax', '5050', 'Council Tax', 'No VAT'),
  ('quickbooks', 'licensing_costs', '5060', 'Licence Fees', 'No VAT'),
  ('quickbooks', 'professional_fees', '5070', 'Professional Fees', '20.0% S'),
  ('quickbooks', 'other_costs', '5080', 'Sundry Expenses', '20.0% S'),
  ('quickbooks', 'void_loss', '5090', 'Void Costs', 'No VAT')
on conflict do nothing;

-- Generic / FreeAgent / Sage (simplified)
insert into public.accounting_mappings (accounting_system, hydrogencap_category, account_code, account_name) values
  ('generic', 'gross_rent_received', 'INC001', 'Rental Income'),
  ('generic', 'other_income', 'INC002', 'Other Income'),
  ('generic', 'management_fees', 'EXP001', 'Management Fees'),
  ('generic', 'maintenance_costs', 'EXP002', 'Repairs & Maintenance'),
  ('generic', 'insurance_costs', 'EXP003', 'Insurance'),
  ('generic', 'mortgage_payments', 'EXP004', 'Finance Costs'),
  ('generic', 'utilities', 'EXP005', 'Utilities'),
  ('generic', 'council_tax', 'EXP006', 'Council Tax'),
  ('generic', 'licensing_costs', 'EXP007', 'Licence Fees'),
  ('generic', 'professional_fees', 'EXP008', 'Professional Fees'),
  ('generic', 'other_costs', 'EXP009', 'Sundry Expenses'),
  ('generic', 'void_loss', 'EXP010', 'Void Costs')
on conflict do nothing;
```

---

## Export Formats

### 1. Xero CSV Import Format

Xero accepts CSV files with these columns for manual journal import:

```
*Date,*Amount,*AccountCode,Description,Reference,TaxType
01/02/2026,1500.00,200,Rent received - 14 High Street Room 1,REC-2026-02-001,NONE
01/02/2026,-85.00,401,Plumber callout - 14 High Street,MNT-WO-2026-0042,INPUT2
```

Rules:
- Dates in DD/MM/YYYY
- Positive amounts for income, negative for expenses
- AccountCode maps to chart of accounts
- Reference should include the HydrogenCap record ID for traceability

### 2. QuickBooks IIF/CSV Format

QuickBooks Desktop accepts IIF files; QuickBooks Online accepts CSV:

**QuickBooks Online CSV:**
```
Date,Description,Amount,Account,Name,Class
02/01/2026,Rental Income - 14 High Street,1500.00,Rental Income,,Property 1
02/01/2026,Repairs - Plumber,-85.00,Repairs & Maintenance,,Property 1
```

### 3. Generic CSV Export

A clean, universal format that any accountant can work with:

```
Date,Entity,Property,Category,Description,Income,Expense,Net,Reference,VAT
01/02/2026,Hydrogen Prop 1 Ltd,14 High Street OX1 2AB,Rental Income,Room 1 - February 2026,1500.00,,1500.00,REC-2026-02-001,N/A
01/02/2026,Hydrogen Prop 1 Ltd,14 High Street OX1 2AB,Repairs & Maintenance,Plumber callout - leaking tap,,85.00,-85.00,WO-2026-0042,£17.00
```

### 4. Bank Reconciliation Export (OFX/QIF)

For importing into accounting software as bank transactions:

**QIF Format:**
```
!Type:Bank
D01/02/2026
T1500.00
PRent - 14 High Street Room 1
NREC-2026-02-001
^
D01/02/2026
T-85.00
PRepairs - Plumber callout
NWO-2026-0042
^
```

### 5. HMRC Self-Assessment Format

For personal landlords (entity_type = 'personal'), generate a summary matching the UK Property Income section of the self-assessment tax return (SA105):

```
Tax Year: 2025/26 (6 April 2025 - 5 April 2026)

Box 20: Total rents and other income from property: £XX,XXX.XX
Box 21: Tax taken off any income in box 20: £0.00
Box 24: Rent, rates, insurance, ground rents: £X,XXX.XX
Box 25: Property repairs, maintenance and renewals: £X,XXX.XX
Box 26: Loan interest and other financial costs: £X,XXX.XX
Box 27: Legal, management and other professional fees: £X,XXX.XX
Box 28: Cost of services provided, including wages: £X,XXX.XX
Box 29: Other allowable property expenses: £X,XXX.XX
Box 30: Private use adjustment: £0.00
Box 37: Taxable profit or loss: £XX,XXX.XX
Box 38: Unused losses brought forward: £0.00
Box 39: Tax adjustments: £0.00
Box 40: Adjusted profit for tax purposes: £XX,XXX.XX
Box 44: Residential finance costs (Section 24): £X,XXX.XX
```

---

## UI — Accounting Page

Create an **Accounting** page accessible from the sidebar (icon: 📊, label: "Accounting"). Position after Investors or at the bottom of the finance group.

### Accounting Page Layout

Three main sections: Export, Tax Summaries, and Account Mappings.

### Export Section

**Export Summary Stats:**
3 stat cards:
1. **Last Export** — date and entity of most recent export. Or "No exports yet."
2. **Current Tax Year** — "2025/26" with progress indicator: "10 of 12 months recorded" (based on financial_snapshots count)
3. **Entities with Data** — count of entities that have financial_snapshots

**Export Builder:**

A step-by-step export configuration form:

**Step 1 — What to Export:**
Radio buttons:
- **Income & Expense Transactions** — monthly breakdown of all financial snapshot line items as individual transactions
- **Combined Journal** — all transactions as double-entry journal entries
- **Bank Reconciliation** — rent receipts and expense payments formatted for bank import
- **Rent Schedule** — detailed rent roll with tenant, room, amount, payment status per month
- **Tax Year Summary** — HMRC-ready summary for self-assessment
- **Full Accounting Package** — everything above in one ZIP file

**Step 2 — Scope:**
- **Entity** (dropdown: All Entities / specific entity — required)
- **Period** (date pickers: from/to — default: current tax year)
- Or quick select: "This Tax Year", "Last Tax Year", "This Calendar Year", "Last Quarter", "Custom"

**Step 3 — Format:**
- **Accounting System** (dropdown: Xero, QuickBooks, FreeAgent, Sage, Generic CSV)
- **File Format** (auto-selected based on system: Xero = CSV, QuickBooks = CSV, Generic = CSV or XLSX, Bank = QIF or OFX)

**Step 4 — Preview & Download:**
- Show a preview table of the first 20 rows of the export
- Row count: "This export contains XXX transactions"
- Total income: £XX,XXX / Total expenses: £XX,XXX / Net: £XX,XXX
- "Download" button — generates the file, creates an accounting_exports record, and downloads

### Tax Year Summary Section

**Tax Year Selector:**
Dropdown of tax years (auto-generated from available financial_snapshot data): "2025/26", "2024/25", etc.

**Per-Entity Tax Summary Cards:**
For each entity with data in the selected tax year, show a card:

**Card Header:**
- Entity name + type badge
- Tax year
- "Generate / Refresh" button — calls `generate_tax_year_summary`
- "Lock" button — locks the summary (prevents accidental regeneration)
- "Export for SA105" button (only for personal entities — generates the HMRC self-assessment format)
- "Export for CT600" button (only for SPVs — placeholder label, structure differs for corporation tax)

**Card Content — Two columns:**

**Income (left):**
- Rental Income: £XX,XXX
- Other Income: £XX,XXX
- **Total Income: £XX,XXX** (bold)

**Expenses (right):**
- Repairs & Maintenance: £XX,XXX
- Insurance: £XX,XXX
- Management Fees: £XX,XXX
- Professional Fees: £XX,XXX
- Utilities: £XX,XXX
- Council Tax: £XX,XXX
- Licensing: £XX,XXX
- Other Expenses: £XX,XXX
- **Total Allowable Expenses: £XX,XXX** (bold)

**Bottom row:**
- **Net Rental Profit: £XX,XXX** (bold, green if positive, red if negative)
- Finance Costs (Mortgage Interest): £XX,XXX
- For personal entities: "Basic Rate Tax Reduction (20%): £XX,XXX" — with explanatory tooltip: "Since April 2020, mortgage interest for individual landlords is claimed as a 20% tax credit, not as an expense."
- For SPV entities: "Corporation Tax Deductible Interest: £XX,XXX"

**Data Quality Indicator:**
Show how many months of financial_snapshots exist for this entity in this tax year:
- "12 of 12 months recorded" in green
- "8 of 12 months recorded — 4 months missing" in amber
- Missing months listed: "Missing: July, August, September, October"

### Account Mappings Section

**Mapping Configuration:**

**Accounting System Selector:** Tabs for each system: Xero | QuickBooks | FreeAgent | Sage | Generic

**Mapping Table:**
For the selected accounting system, show a table:

| HydrogenCap Category | Account Code | Account Name | Tax Rate | Active |
|---|---|---|---|---|
| Rental Income | 200 | Rental Income | NONE | ✅ |
| Management Fees | 400 | Management Fees | INPUT2 | ✅ |
| Repairs & Maintenance | 401 | Repairs & Maintenance | INPUT2 | ✅ |
| ... | ... | ... | ... | ... |

Each row is editable inline:
- Account Code (text input)
- Account Name (text input)
- Tax Rate Code (text input — hint showing system-specific codes)
- Active toggle

**Entity Override:**
Add an "Entity-specific overrides" toggle. When on, show an entity dropdown that lets the user set different account codes per entity. This handles the case where different SPVs use different chart of accounts structures (common when different accountants handle different SPVs).

**Import Chart of Accounts:**
"Import from CSV" button — accepts a CSV of account codes and names, populates the mapping table. Useful for accountants who export their chart of accounts.

**Reset to Defaults:**
"Reset to Defaults" button — restores the seeded default mappings for the selected system.

---

## UI — Update Financial Snapshots Page

Add a small "Export" button to the Financials page:
- Quick export of the current view (property performance table or monthly summary) as CSV
- Uses the selected accounting system format if configured, otherwise generic

---

## UI — Update Entity Detail Page

Add an "Accounting" section to the Entity Detail page:

- Current tax year summary card (mini version of the tax year summary)
- "Export Transactions" quick button — pre-scoped to this entity, current tax year
- Last export date and download link
- Data quality indicator: months recorded vs expected

---

## Export File Generation Logic

### Transaction Line Generation

When generating an income/expense transaction export, iterate through financial_snapshots for the selected entity and period. For each snapshot (one per property per month), generate transaction lines:

```typescript
function generateTransactionLines(
  snapshot: FinancialSnapshot,
  property: Property,
  entity: LegalEntity,
  mappings: AccountingMapping[],
  format: 'xero' | 'quickbooks' | 'generic'
): TransactionLine[] {
  const lines: TransactionLine[] = [];
  const monthLabel = formatMonth(snapshot.snapshot_month); // "February 2026"
  const propRef = property.address_line_1;

  // Income lines
  if (snapshot.gross_rent_received > 0) {
    lines.push({
      date: snapshot.snapshot_month,
      amount: snapshot.gross_rent_received,
      category: 'gross_rent_received',
      description: `Rental income - ${propRef} - ${monthLabel}`,
      reference: `RNT-${formatRef(snapshot.snapshot_month)}-${property.id.slice(0,4)}`,
    });
  }

  if (snapshot.other_income > 0) {
    lines.push({
      date: snapshot.snapshot_month,
      amount: snapshot.other_income,
      category: 'other_income',
      description: `Other income - ${propRef} - ${monthLabel}`,
      reference: `OTH-${formatRef(snapshot.snapshot_month)}-${property.id.slice(0,4)}`,
    });
  }

  // Expense lines (as negative amounts for Xero, positive for generic)
  const expenseFields = [
    { field: 'management_fees', label: 'Management fees' },
    { field: 'maintenance_costs', label: 'Repairs & maintenance' },
    { field: 'insurance_costs', label: 'Insurance' },
    { field: 'mortgage_payments', label: 'Mortgage interest' },
    { field: 'utilities', label: 'Utilities' },
    { field: 'council_tax', label: 'Council tax' },
    { field: 'licensing_costs', label: 'Licensing' },
    { field: 'professional_fees', label: 'Professional fees' },
    { field: 'other_costs', label: 'Other expenses' },
  ];

  for (const ef of expenseFields) {
    const value = snapshot[ef.field];
    if (value > 0) {
      lines.push({
        date: snapshot.snapshot_month,
        amount: format === 'xero' ? -value : value,
        category: ef.field,
        description: `${ef.label} - ${propRef} - ${monthLabel}`,
        reference: `EXP-${formatRef(snapshot.snapshot_month)}-${property.id.slice(0,4)}`,
        isExpense: true,
      });
    }
  }

  return lines;
}
```

### CSV Generation

Use a client-side CSV library (papaparse or manual string building) to generate CSV content. Apply the accounting_mappings to translate categories into account codes before export.

### XLSX Generation

For Excel exports, use a library like SheetJS (xlsx) to generate proper .xlsx files with:
- Summary sheet (totals, period, entity)
- Transactions sheet (all line items)
- Mappings sheet (account codes used)
- Formatting: currency cells, date cells, header row styling

---

## UI — Maintenance Cost Integration

When generating expense exports, also pull in completed works_orders as individual transaction lines:

For each works_order with status = 'paid' in the export period:
- Date: paid_date (or completion_date)
- Amount: paid_amount
- Category: 'maintenance_costs'
- Description: works order title + order number
- Reference: WO-YYYY-NNNN

This provides granular maintenance cost data in the accounting export, rather than just the monthly total from financial_snapshots. If both sources exist, prefer the works_order detail and reconcile against the snapshot total.

---

## UI — Compliance Cost Integration

When generating expense exports, also pull compliance_documents with a cost value:

For each compliance_document with cost > 0 and uploaded_at in the export period:
- Date: issue_date
- Amount: cost
- Category: 'professional_fees' (or map by document_type: gas safety → maintenance, insurance → insurance, etc.)
- Description: document type human-readable name + property address
- Reference: document certificate_number or ID

---

## Scheduled Export Reminders

Add to the notification system (from 2.2):

Create escalation rules for accounting:

```sql
insert into public.escalation_rules (document_type, rule_name, trigger_condition, trigger_value, action_type, action_config) values
  (null, 'Monthly accounting reminder', 'days_after_expiry', 5, 'send_notification',
   '{"notification_type": "custom", "channel": "in_app", "message": "Financial snapshots for last month may be ready for accounting export."}');
```

Add a notification_category 'accounting_reminder' to the notification_preferences table options.

---

## Design

- The export builder should feel like a wizard — step by step, no overwhelm. The accountant does not want 15 options on one screen. They want: What → Which entity → Which period → Download.
- The tax year summary cards are the most important view for year-end. They must match the HMRC self-assessment form structure so the accountant can transfer numbers directly. If the numbers in HydrogenCap match box-for-box with SA105, the accountant trusts the system.
- The data quality indicator (months recorded vs expected) is critical. If 4 months of data are missing, the tax summary is wrong. Surface this prominently so the operator fills in the gaps before sending to the accountant.
- Account code mappings should be a "set once, forget" configuration. Default mappings get most people started. The accountant can review and adjust codes in 5 minutes. After that, every export uses the right codes automatically.
- The mortgage interest treatment difference (personal vs SPV) is a common source of tax errors. The UI must make this clear — it's not just a number, it's a different tax mechanism. The explanatory tooltip is essential.

## TypeScript

Generate types for: accounting_mappings, accounting_exports, tax_year_summaries. Create types for the export builder: `ExportConfig`, `TransactionLine`, `ExportFormat`. Create a `AccountingSystem` union type. Type the CSV/XLSX generation functions. Create a `TaxYearLabel` type for the "YYYY/YY" format.
