
-- ══════════════════════════════════════════════════
-- Phase 2.7A: Accounting Export — Tables & Infrastructure
-- ══════════════════════════════════════════════════

-- 1. accounting_mappings
create table public.accounting_mappings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id),
  accounting_system text not null,
  entity_id uuid references public.legal_entities(id) on delete cascade,
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

-- 2. accounting_exports
create table public.accounting_exports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id),
  entity_id uuid references public.legal_entities(id) on delete set null,
  export_type text not null,
  accounting_system text not null,
  period_from date not null,
  period_to date not null,
  file_url text,
  file_name text,
  file_format text not null,
  row_count integer,
  total_income numeric(12,2),
  total_expenses numeric(12,2),
  generated_by uuid,
  generated_at timestamptz default now(),
  notes text
);

create index idx_accounting_exports_entity on public.accounting_exports(entity_id);
create index idx_accounting_exports_period on public.accounting_exports(period_from, period_to);

-- 3. tax_year_summaries
create table public.tax_year_summaries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id),
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

-- ══════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════

alter table public.accounting_mappings enable row level security;
alter table public.accounting_exports enable row level security;
alter table public.tax_year_summaries enable row level security;

-- accounting_mappings: org-scoped + allow global (null org_id) read
create policy "Users can read own org mappings or global"
  on public.accounting_mappings for select
  to authenticated
  using (org_id is null or org_id in (select org_id from public.memberships where user_id = auth.uid()));

create policy "Users can insert own org mappings"
  on public.accounting_mappings for insert
  to authenticated
  with check (org_id in (select org_id from public.memberships where user_id = auth.uid()));

create policy "Users can update own org mappings"
  on public.accounting_mappings for update
  to authenticated
  using (org_id in (select org_id from public.memberships where user_id = auth.uid()));

create policy "Users can delete own org mappings"
  on public.accounting_mappings for delete
  to authenticated
  using (org_id in (select org_id from public.memberships where user_id = auth.uid()));

-- accounting_exports: org-scoped
create policy "Users can manage own org exports"
  on public.accounting_exports for all
  to authenticated
  using (org_id in (select org_id from public.memberships where user_id = auth.uid()))
  with check (org_id in (select org_id from public.memberships where user_id = auth.uid()));

-- tax_year_summaries: org-scoped
create policy "Users can manage own org tax summaries"
  on public.tax_year_summaries for all
  to authenticated
  using (org_id in (select org_id from public.memberships where user_id = auth.uid()))
  with check (org_id in (select org_id from public.memberships where user_id = auth.uid()));

-- ══════════════════════════════════════════════════
-- Audit Triggers
-- ══════════════════════════════════════════════════

create trigger audit_accounting_mappings
  after insert or update or delete on public.accounting_mappings
  for each row execute function public.audit_trigger_function();

create trigger audit_tax_year_summaries
  after insert or update or delete on public.tax_year_summaries
  for each row execute function public.audit_trigger_function();

-- updated_at triggers
create trigger set_accounting_mappings_updated_at
  before update on public.accounting_mappings
  for each row execute function public.update_updated_at_column();

create trigger set_tax_year_summaries_updated_at
  before update on public.tax_year_summaries
  for each row execute function public.update_updated_at_column();

-- ══════════════════════════════════════════════════
-- Generate Tax Year Summary Function
-- ══════════════════════════════════════════════════

create or replace function public.generate_tax_year_summary(
  target_entity_id uuid,
  target_tax_year text,
  target_org_id uuid
)
returns uuid as $$
declare
  year_start date;
  year_end date;
  start_year integer;
  summary_id uuid;
begin
  start_year := split_part(target_tax_year, '/', 1)::integer;
  year_start := (start_year || '-04-06')::date;
  year_end := ((start_year + 1) || '-04-05')::date;

  insert into public.tax_year_summaries (
    org_id, entity_id, tax_year, tax_year_start, tax_year_end,
    total_rental_income, total_other_income,
    total_mortgage_interest, total_repairs_maintenance,
    total_insurance, total_management_fees,
    total_professional_fees, total_utilities,
    total_council_tax, total_licensing,
    total_other_expenses, finance_costs
  )
  select
    target_org_id,
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
    and fs.snapshot_month >= year_start::text
    and fs.snapshot_month <= year_end::text
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
$$ language plpgsql security definer set search_path = public;

-- ══════════════════════════════════════════════════
-- Seed Default Accounting Mappings (global, no org_id)
-- ══════════════════════════════════════════════════

-- Xero defaults
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
  ('xero', 'void_loss', '409', 'Void Loss', 'NONE');

-- QuickBooks defaults
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
  ('quickbooks', 'void_loss', '5090', 'Void Costs', 'No VAT');

-- Generic defaults
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
  ('generic', 'void_loss', 'EXP010', 'Void Costs');
