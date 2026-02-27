# HydrogenCap — NEXT Phase 2.1: Rent Collection & Reconciliation

## Context

HydrogenCap now has a solid foundation: legal entities, properties, rooms, tenants, tenancy agreements, loan facilities, compliance documents, financial snapshots, and an audit log. The NEXT phase adds automation — and rent reconciliation is the single highest-impact automation for an HMO operator.

At 50 properties with 6 rooms each, that is 300 tenants paying rent monthly. Without reconciliation, the operator is manually checking 300 bank transactions against 300 expected payments every month. That is 5+ hours of mind-numbing work, prone to error, and always behind.

We cannot yet integrate Open Banking (that requires a TrueLayer or Plaid backend integration beyond Lovable's scope), but we can build the full reconciliation engine with CSV bank statement import. The matching logic, arrears tracking, and reporting all work the same regardless of whether transactions come from a CSV or a live bank feed. When Open Banking is added later, it simply replaces the import step — everything downstream stays the same.

## Database Tables

### `bank_accounts`

Track which bank accounts are used for rent collection, per entity:

```sql
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.legal_entities(id) on delete restrict,
  account_name text not null,
  bank_name text not null,
  sort_code text,
  account_number text,
  account_type text not null default 'current' check (account_type in ('current', 'savings', 'rent_collection', 'reserve')),
  currency text default 'GBP',
  is_primary boolean default false,
  is_active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_bank_accounts_entity_id on public.bank_accounts(entity_id);
```

### `bank_transactions`

Raw imported transactions from bank statements:

```sql
create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts(id) on delete restrict,
  transaction_date date not null,
  description text not null,
  reference text,
  amount numeric(10,2) not null,
  transaction_type text not null check (transaction_type in ('credit', 'debit')),
  balance_after numeric(12,2),
  import_batch_id uuid,
  import_source text default 'csv',
  is_duplicate boolean default false,
  created_at timestamptz default now()
);

create index idx_bank_transactions_account_id on public.bank_transactions(bank_account_id);
create index idx_bank_transactions_date on public.bank_transactions(transaction_date);
create index idx_bank_transactions_batch on public.bank_transactions(import_batch_id);
create index idx_bank_transactions_amount on public.bank_transactions(amount);
```

### `rent_ledger`

The expected rent schedule — what each tenant owes each month:

```sql
create table public.rent_ledger (
  id uuid primary key default gen_random_uuid(),
  tenancy_agreement_id uuid not null references public.tenancy_agreements(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  room_id uuid not null references public.rooms(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  amount_due numeric(8,2) not null,
  amount_received numeric(8,2) default 0,
  amount_outstanding numeric(8,2) generated always as (amount_due - amount_received) stored,
  status text not null default 'due' check (status in ('due', 'paid', 'partial', 'overdue', 'written_off', 'waived', 'credited')),
  due_date date not null,
  last_payment_date date,
  days_overdue integer generated always as (
    case
      when status in ('due', 'partial', 'overdue') and current_date > due_date
      then (current_date - due_date)
      else 0
    end
  ) stored,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenancy_agreement_id, period_start)
);

create index idx_rent_ledger_tenancy on public.rent_ledger(tenancy_agreement_id);
create index idx_rent_ledger_tenant on public.rent_ledger(tenant_id);
create index idx_rent_ledger_property on public.rent_ledger(property_id);
create index idx_rent_ledger_status on public.rent_ledger(status);
create index idx_rent_ledger_due_date on public.rent_ledger(due_date);
create index idx_rent_ledger_period on public.rent_ledger(period_start, period_end);
```

If generated columns cause issues, use a trigger (same pattern as financial_snapshots):

```sql
create or replace function public.calculate_rent_ledger_fields()
returns trigger as $$
begin
  NEW.amount_outstanding := NEW.amount_due - NEW.amount_received;
  NEW.days_overdue := case
    when NEW.status in ('due', 'partial', 'overdue') and current_date > NEW.due_date
    then (current_date - NEW.due_date)
    else 0
  end;
  return NEW;
end;
$$ language plpgsql;

create trigger trigger_calc_rent_ledger
before insert or update on public.rent_ledger
for each row execute function public.calculate_rent_ledger_fields();
```

### `rent_payments`

Links bank transactions to rent ledger entries. This is the reconciliation junction:

```sql
create table public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  rent_ledger_id uuid not null references public.rent_ledger(id) on delete restrict,
  bank_transaction_id uuid references public.bank_transactions(id) on delete set null,
  amount numeric(8,2) not null,
  payment_date date not null,
  payment_method text not null default 'bank_transfer' check (payment_method in ('bank_transfer', 'standing_order', 'direct_debit', 'cash', 'cheque', 'housing_benefit', 'universal_credit', 'other')),
  reconciliation_method text not null default 'manual' check (reconciliation_method in ('auto_matched', 'manual', 'bulk_import')),
  match_confidence numeric(3,2),
  notes text,
  created_at timestamptz default now()
);

create index idx_rent_payments_ledger on public.rent_payments(rent_ledger_id);
create index idx_rent_payments_transaction on public.rent_payments(bank_transaction_id);
create index idx_rent_payments_date on public.rent_payments(payment_date);
```

### `import_batches`

Track CSV import history:

```sql
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts(id),
  file_name text not null,
  row_count integer not null,
  imported_count integer not null,
  duplicate_count integer default 0,
  date_range_start date,
  date_range_end date,
  status text default 'completed' check (status in ('processing', 'completed', 'failed', 'rolled_back')),
  error_message text,
  imported_by uuid,
  imported_at timestamptz default now()
);
```

### RLS Policies

```sql
alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.rent_ledger enable row level security;
alter table public.rent_payments enable row level security;
alter table public.import_batches enable row level security;

create policy "Authenticated access" on public.bank_accounts for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated access" on public.bank_transactions for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated access" on public.rent_ledger for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated access" on public.rent_payments for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated access" on public.import_batches for all using (auth.uid() is not null) with check (auth.uid() is not null);
```

### Audit Triggers

```sql
create trigger audit_bank_accounts after insert or update or delete on public.bank_accounts for each row execute function public.audit_trigger_function();
create trigger audit_rent_ledger after insert or update or delete on public.rent_ledger for each row execute function public.audit_trigger_function();
create trigger audit_rent_payments after insert or update or delete on public.rent_payments for each row execute function public.audit_trigger_function();
```

### Auto-Generate Rent Ledger Entries

Create a function that generates rent ledger entries for a given month based on active tenancy agreements. This should be callable on demand and idempotent (it skips entries that already exist):

```sql
create or replace function public.generate_rent_ledger(target_month date)
returns integer as $$
declare
  entries_created integer := 0;
  ta record;
  month_start date;
  month_end date;
begin
  month_start := date_trunc('month', target_month)::date;
  month_end := (date_trunc('month', target_month) + interval '1 month' - interval '1 day')::date;

  for ta in
    select
      ta.id as tenancy_id,
      ta.tenant_id,
      ta.property_id,
      ta.room_id,
      ta.rent_amount_pcm,
      ta.start_date,
      ta.actual_end_date
    from public.tenancy_agreements ta
    where ta.status in ('active', 'notice_period')
      and ta.start_date <= month_end
      and (ta.actual_end_date is null or ta.actual_end_date >= month_start)
  loop
    -- Skip if entry already exists for this tenancy and period
    if not exists (
      select 1 from public.rent_ledger
      where tenancy_agreement_id = ta.tenancy_id and period_start = month_start
    ) then
      insert into public.rent_ledger (
        tenancy_agreement_id, tenant_id, property_id, room_id,
        period_start, period_end, amount_due, due_date
      ) values (
        ta.tenancy_id, ta.tenant_id, ta.property_id, ta.room_id,
        month_start, month_end, ta.rent_amount_pcm,
        month_start + interval '1 day' -- Due on 1st of month; adjust if your tenancies use different due dates
      );
      entries_created := entries_created + 1;
    end if;
  end loop;

  return entries_created;
end;
$$ language plpgsql security definer;
```

### Auto-Update Rent Ledger Status

Create a function that updates ledger statuses based on payments and dates:

```sql
create or replace function public.refresh_rent_ledger_statuses()
returns void as $$
begin
  -- Update amount_received from rent_payments
  update public.rent_ledger rl
  set amount_received = coalesce(sub.total_paid, 0),
      last_payment_date = sub.last_date,
      updated_at = now()
  from (
    select rent_ledger_id, sum(amount) as total_paid, max(payment_date) as last_date
    from public.rent_payments
    group by rent_ledger_id
  ) sub
  where rl.id = sub.rent_ledger_id;

  -- Recalculate statuses
  update public.rent_ledger
  set status = case
    when amount_received >= amount_due then 'paid'
    when amount_received > 0 and amount_received < amount_due and current_date > due_date then 'overdue'
    when amount_received > 0 and amount_received < amount_due then 'partial'
    when amount_received = 0 and current_date > due_date + interval '3 days' then 'overdue'
    else 'due'
  end,
  updated_at = now()
  where status not in ('written_off', 'waived', 'credited');
end;
$$ language plpgsql security definer;
```

### Rent Collection Summary Views

```sql
create or replace view public.rent_collection_summary as
select
  rl.property_id,
  p.address_line_1 || ', ' || p.postcode as property_address,
  le.entity_name,
  rl.period_start as month,
  count(*) as total_entries,
  count(*) filter (where rl.status = 'paid') as paid_count,
  count(*) filter (where rl.status = 'partial') as partial_count,
  count(*) filter (where rl.status in ('due', 'overdue')) as unpaid_count,
  count(*) filter (where rl.status = 'overdue') as overdue_count,
  sum(rl.amount_due) as total_due,
  sum(rl.amount_received) as total_received,
  sum(rl.amount_due - rl.amount_received) as total_outstanding,
  case
    when sum(rl.amount_due) > 0
    then round((sum(rl.amount_received) / sum(rl.amount_due) * 100)::numeric, 1)
    else 100
  end as collection_rate_pct
from public.rent_ledger rl
join public.properties p on p.id = rl.property_id
join public.legal_entities le on le.id = p.entity_id
group by rl.property_id, p.address_line_1, p.postcode, le.entity_name, rl.period_start
order by rl.period_start desc, property_address;
```

```sql
create or replace view public.arrears_summary as
select
  rl.id as ledger_id,
  rl.tenant_id,
  t.first_name || ' ' || t.last_name as tenant_name,
  t.tenant_type,
  rl.property_id,
  p.address_line_1 || ', ' || p.postcode as property_address,
  r.room_name,
  rl.period_start,
  rl.amount_due,
  rl.amount_received,
  rl.amount_due - rl.amount_received as amount_outstanding,
  rl.due_date,
  current_date - rl.due_date as days_overdue,
  rl.status
from public.rent_ledger rl
join public.tenants t on t.id = rl.tenant_id
join public.properties p on p.id = rl.property_id
join public.rooms r on r.id = rl.room_id
where rl.status in ('overdue', 'partial')
  and (rl.amount_due - rl.amount_received) > 0
order by (rl.amount_due - rl.amount_received) desc;
```

```sql
create or replace view public.tenant_payment_history as
select
  t.id as tenant_id,
  t.first_name || ' ' || t.last_name as tenant_name,
  count(rl.id) as total_periods,
  count(rl.id) filter (where rl.status = 'paid') as paid_on_time,
  count(rl.id) filter (where rl.status = 'overdue' or rl.last_payment_date > rl.due_date + interval '3 days') as paid_late,
  count(rl.id) filter (where rl.status in ('overdue', 'partial') and rl.amount_received < rl.amount_due) as currently_outstanding,
  sum(rl.amount_due) as total_rent_due,
  sum(rl.amount_received) as total_rent_paid,
  case
    when count(rl.id) > 0
    then round((count(rl.id) filter (where rl.status = 'paid')::numeric / count(rl.id)::numeric * 100), 1)
    else 100
  end as payment_reliability_pct
from public.tenants t
left join public.rent_ledger rl on rl.tenant_id = t.id
where t.status = 'active'
group by t.id, t.first_name, t.last_name
order by payment_reliability_pct asc;
```

---

## UI — Rent Collection Page

Create a **Rent Collection** page accessible from the sidebar (icon: 🏦, label: "Rent Collection"). Position it after Tenants in the nav.

### Rent Collection Summary Stats Bar

5 stat cards:

1. **Collection Rate** — portfolio-wide for current month. Percentage. Green ≥95%, amber 90-94%, red <90%. This is the headline number.
2. **Rent Due** — total amount due this month across all tenancies. £XX,XXX.
3. **Rent Received** — total received this month. £XX,XXX.
4. **Outstanding** — total due minus received. £XX,XXX in red if > 0.
5. **Tenants in Arrears** — count of tenants with overdue status. Red if > 0.

### Month Selector

A month picker at the top right. Default: current month. Changing the month refreshes all data below. Show previous/next month arrows for quick navigation.

### Rent Roll Table

The primary view. A table showing every rent ledger entry for the selected month:

**Columns:**
- **Tenant** (name, clickable to tenant detail)
- **Property** (address, clickable to property detail)
- **Room** (room name)
- **Rent Due** (£XXX.XX)
- **Rent Received** (£XXX.XX)
- **Outstanding** (£XXX.XX — red if > 0, green "£0.00" if fully paid)
- **Status** — coloured badge:
  - paid = "Paid" green
  - partial = "Partial" amber
  - due = "Due" blue
  - overdue = "Overdue" red (with days count: "Overdue 14d")
  - written_off = "Written Off" grey strikethrough
  - waived = "Waived" grey
  - credited = "Credited" purple
- **Actions** — "Record Payment" button (small), "View" button

**Grouping:**
Provide a toggle to group by: None (flat list) / Property / Entity. When grouped, show subtotals per group for amount due, received, and outstanding with collection rate percentage.

**Filtering:**
- Status: All / Paid / Outstanding / Overdue
- Property: dropdown
- Entity: dropdown
- Tenant type: dropdown (useful for tracking DSS/UC payments separately since they arrive on different schedules)

**Default view:** Outstanding items only, sorted by days overdue descending (worst arrears first).

### Generate Rent Roll Button

A prominent "Generate Rent Roll" button above the table. When clicked:
1. Asks for confirmation: "Generate rent entries for [Month Year]? This will create ledger entries for all active tenancies."
2. Calls the `generate_rent_ledger` function for the selected month.
3. Shows result: "Created XX rent entries for [Month Year]"
4. Refreshes the table.

If entries already exist, the function is idempotent — it only creates missing entries and skips existing ones. Show a note: "X entries already existed and were skipped."

---

## UI — Record Payment Modal

Accessed from the "Record Payment" button on a rent roll row, or from the tenant detail page.

**Fields:**
- **Tenant** (read-only, pre-filled)
- **Property / Room** (read-only, pre-filled)
- **Period** (read-only, pre-filled: "February 2026")
- **Amount Due** (read-only: £XXX.XX)
- **Already Received** (read-only: £XX.XX, if partial payments exist)
- **Payment Amount** (currency £, required — default to outstanding amount)
- **Payment Date** (date picker, default today)
- **Payment Method** (dropdown: Bank Transfer, Standing Order, Direct Debit, Cash, Cheque, Housing Benefit, Universal Credit, Other)
- **Bank Transaction** (optional — searchable dropdown of unreconciled credit transactions from bank_transactions for the relevant bank account. Shows: date, description, amount. This is manual reconciliation — linking a payment to a specific bank transaction.)
- **Notes** (textarea, optional)

**On save:**
1. Create rent_payment record linking to the rent_ledger entry (and bank_transaction if selected)
2. Update the rent_ledger amount_received and status
3. If amount_received >= amount_due, set status = 'paid'
4. If amount_received > 0 but < amount_due, set status = 'partial'
5. If a bank_transaction was linked, mark it as reconciled (we will handle this state in the reconciliation UI)
6. Show success and refresh the table

**Quick Pay:**
For the common case where rent is paid in full on time: add a "Mark as Paid" quick action on each rent roll row. One click: creates a payment for the full amount due, dated today, method = 'bank_transfer', no bank transaction link. Confirmation tooltip: "Mark as paid in full for £XXX.XX?"

---

## UI — Arrears Dashboard

A sub-tab within the Rent Collection page, or a separate "Arrears" section below the rent roll.

### Arrears Table

Data from `arrears_summary` view. Shows only tenants with outstanding balances:

**Columns:**
- **Tenant** (name, clickable)
- **Type** (tenant_type badge — important because DSS/UC payments are often delayed, not truly in arrears)
- **Property** (address)
- **Room**
- **Period** (which month is overdue)
- **Amount Outstanding** (£XX.XX — bold, red)
- **Days Overdue** (number, colour-coded: amber 1-7 days, red 8-30 days, dark red 30+ days)
- **Actions**: Record Payment, Send Reminder (placeholder for now), Write Off

**Arrears Aging Summary:**
Above the table, show 4 cards breaking down arrears by age:
1. **1-7 Days** — count of entries and total £ value. Amber.
2. **8-14 Days** — count and £. Red.
3. **15-30 Days** — count and £. Dark red.
4. **30+ Days** — count and £. Dark red with warning icon.

### Tenant Payment Reliability

A separate sub-tab showing the `tenant_payment_history` view. This ranks tenants by payment reliability:

**Columns:**
- **Tenant** (name, clickable)
- **Total Periods** (how many months of rent tracked)
- **Paid on Time** (count + percentage)
- **Paid Late** (count)
- **Currently Outstanding** (count of unpaid/partial periods)
- **Reliability Score** (percentage — green ≥95%, amber 80-94%, red <80%)

Sort by reliability ascending (worst payers first). This view helps operators identify problem tenants early — a tenant who has paid late 3 out of 5 months is a risk, even if they are currently up to date.

---

## UI — Bank Statement Import

### Import Flow

Accessible from a "Import Bank Statement" button on the Rent Collection page.

**Step 1 — Select Bank Account:**
- Dropdown of bank accounts (from bank_accounts table)
- "Add Bank Account" option if none exist (opens quick-add modal: account name, bank name, sort code, account number, linked entity)

**Step 2 — Upload CSV:**
- File upload accepting .csv files
- Show a format guidance note: "Supports standard CSV exports from most UK banks. Columns should include: date, description/reference, amount (or separate debit/credit columns), and optionally balance."
- Parse the CSV client-side and show a preview table of the first 10 rows.

**Step 3 — Column Mapping:**
- Auto-detect common column names (Date, Description, Reference, Amount, Credit, Debit, Balance)
- If auto-detection fails, show dropdown selectors for each required column:
  - Date column (required)
  - Description column (required)
  - Reference column (optional)
  - Amount column (required — or separate Credit and Debit columns)
  - Balance column (optional)
- Date format selector: DD/MM/YYYY (default for UK), MM/DD/YYYY, YYYY-MM-DD
- Show preview of parsed data with the mapping applied

**Step 4 — Review & Import:**
- Show full list of transactions to be imported
- Highlight potential duplicates (matching date + amount + description against existing transactions in the same bank account) in amber with "Duplicate?" badge
- Allow user to deselect duplicates before importing
- Show summary: "XX transactions to import, XX duplicates skipped, date range: DD/MM/YYYY to DD/MM/YYYY"
- "Import" button

**On import:**
1. Create import_batch record
2. Insert all bank_transactions with the import_batch_id
3. Mark duplicates with is_duplicate = true (imported but flagged)
4. Show success: "Imported XX transactions from [filename]"
5. Navigate to the reconciliation view

---

## UI — Reconciliation View

After importing bank transactions, show a reconciliation interface. This is split-screen or two-panel:

### Left Panel — Unreconciled Bank Transactions

List of credit transactions from bank_transactions that have not been linked to any rent_payment. Show:
- Date
- Description / Reference
- Amount (£XX.XX)
- Bank account name

Filterable by date range and amount range. Sortable by date or amount.

### Right Panel — Outstanding Rent Entries

List of rent_ledger entries with status = 'due', 'partial', or 'overdue'. Show:
- Tenant name
- Property + room
- Period
- Amount outstanding (£XX.XX)

### Auto-Match

When the reconciliation view loads, run a client-side matching algorithm:

**Match criteria (in order of confidence):**
1. **Exact amount + tenant name in reference** — confidence 0.95. If a bank transaction amount matches a rent_ledger amount_outstanding exactly AND the transaction description/reference contains the tenant's last name, flag as a match.
2. **Exact amount + property reference** — confidence 0.85. If amount matches and description contains a recognisable property reference (address fragment, room number).
3. **Exact amount only** — confidence 0.60. Amount matches but no name/reference match. Suggest but require confirmation.
4. **Close amount (within £5)** — confidence 0.40. Near-match that could be a rounding difference or bank fee. Suggest with warning.

Display matches as linked pairs with confidence badges:
- Green "High Match" (≥0.85)
- Amber "Possible Match" (0.60-0.84)
- Red "Low Confidence" (< 0.60)

The operator reviews each suggested match and either:
- **Confirms** — creates the rent_payment record linking the transaction to the ledger entry
- **Rejects** — dismisses the suggestion
- **Manually links** — drags or selects a transaction and a ledger entry to link them

### Bulk Confirm

A "Confirm All High-Confidence Matches" button that accepts all matches with confidence ≥ 0.85 in one action. Show count: "Confirm XX matches?"

### Unmatched Transactions Panel

After matching, show remaining unmatched transactions in a separate section. These might be:
- Non-rent income (interest, refunds)
- Payments from unknown references
- Payments that do not match any outstanding rent

Allow the operator to categorise these:
- Link to a rent entry (manual match)
- Mark as "Not Rent" with a category tag (mortgage payment, insurance, maintenance, etc.)
- Mark as "Investigate" for later review

---

## UI — Update Tenant Detail Page

Add a **Payment History** section to the Tenant Detail page:

**Payment Timeline:**
- Table showing all rent_ledger entries for this tenant, ordered by period_start descending
- Columns: Period, Amount Due, Amount Received, Outstanding, Status, Payment Date(s), Method
- Paid rows have green left border, overdue have red, partial have amber

**Payment Reliability Card:**
- Total periods tracked
- On-time payment rate (percentage, colour coded)
- Average days to payment (mean days between due_date and last_payment_date)
- Current arrears total (sum of outstanding across all periods)

---

## UI — Update Property Detail Page

Add a **Rent Collection** section to the Property Detail page:

**Current Month Summary:**
- Total rent due (sum across all rooms)
- Total received
- Collection rate percentage
- List of rooms with tenant name and payment status badge

**Collection Rate Trend:**
- Small line chart showing monthly collection rate for this property over last 12 months
- Useful for spotting properties where collection is deteriorating

---

## UI — Update Executive Command Centre

Wire up the **Monthly Cash Position** KPI card to use actual data:
- Rent received this month (from rent_ledger or financial_snapshots)
- Display collection rate alongside the cash position

Add a new item to the "Items Needing Attention" panel:
- Overdue rent entries older than 7 days, showing: tenant name, property, amount, days overdue

---

## Bank Account Management

Add a **Bank Accounts** section within Settings:

**Bank Account List:**
- Table: Account Name, Bank, Sort Code (masked: XX-XX-XX), Account Number (masked: XXXXXX##), Entity, Type, Primary badge
- "Add Bank Account" button

**Add/Edit Bank Account Modal:**
- Account Name (text, required)
- Bank Name (text, required)
- Sort Code (text, optional — format: XX-XX-XX)
- Account Number (text, optional — last 4 digits visible in lists, rest masked)
- Linked Entity (dropdown of legal entities, required)
- Account Type (dropdown: Current, Savings, Rent Collection, Reserve)
- Is Primary (toggle)
- Notes (textarea)

---

## CSV Format Support

The importer should handle common UK bank CSV formats. Include presets for:

**Barclays:**
- Columns: Number, Date, Account, Amount, Subcategory, Memo
- Date format: DD/MM/YYYY

**Lloyds / Halifax:**
- Columns: Transaction Date, Transaction Type, Sort Code, Account Number, Transaction Description, Debit Amount, Credit Amount, Balance
- Date format: DD/MM/YYYY

**NatWest / RBS:**
- Columns: Date, Type, Description, Value, Balance, Account Name, Account Number
- Date format: DD/MM/YYYY

**Monzo:**
- Columns: Transaction ID, Date, Time, Type, Name, Emoji, Category, Amount, Currency, Local amount, Local currency, Notes and #tags, Address, Receipt, Description, Category split, Money Out, Money In
- Date format: DD/MM/YYYY

**Starling:**
- Columns: Date, Counter Party, Reference, Type, Amount (GBP), Balance (GBP), Spending Category
- Date format: DD/MM/YYYY

**Generic CSV:**
- Manual column mapping (the fallback for any bank not listed)

When a CSV is uploaded, attempt to auto-detect the bank format from column headers. If detected, apply the preset mapping automatically. If not detected, fall back to manual column mapping.

---

## Design

- The reconciliation split-panel is the most complex UI in this module. It must feel fluid — ideally drag-and-drop to link transactions to rent entries. If drag-and-drop is too complex for Lovable, use a "Select" button on each side that highlights the selected items, then a "Link Selected" button.
- Arrears displays must feel urgent. Red backgrounds, bold amounts, prominent day counts. Unpaid rent is bleeding cash.
- The Quick Pay action on the rent roll is critical UX — most rent arrives on time via standing order. Confirming 250 on-time payments should take minutes, not hours.
- Masked bank details (sort code and account number) are a security consideration — full numbers should only be visible when explicitly revealed.
- Collection rate percentages must match between the rent collection page, the financial snapshots, and the executive dashboard. Use the rent_ledger as the source of truth.

## TypeScript

Generate types for: bank_accounts, bank_transactions, rent_ledger, rent_payments, import_batches. Type the views: `RentCollectionSummary`, `ArrearsSummary`, `TenantPaymentHistory`. Create types for the CSV import flow: `CSVColumnMapping`, `BankFormatPreset`, `ReconciliationMatch` (with confidence score and match reason).
