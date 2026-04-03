-- Valuation comparable evidence and history tracking
-- Migration: 20260403000010_valuation_evidence.sql

-- ── valuation_comparables ────────────────────────────────────────────────────
create table if not exists public.valuation_comparables (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties_v2(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  comp_address  text not null,
  comp_postcode text,
  sale_price    numeric not null,
  sale_date     date not null,
  property_type text,
  beds          integer,
  sqm           numeric,
  price_per_sqm numeric,
  distance_miles numeric(4,1),
  source        text not null default 'manual'
                check (source in ('land_registry','rightmove','agent','manual')),
  notes         text,
  created_at    timestamptz not null default now()
);

alter table public.valuation_comparables enable row level security;

create policy "Users can view own org valuation_comparables"
  on public.valuation_comparables for select
  using (org_id in (select org_id from public.memberships where user_id = auth.uid()));

create policy "Users can insert own org valuation_comparables"
  on public.valuation_comparables for insert
  with check (org_id in (select org_id from public.memberships where user_id = auth.uid()));

create policy "Users can update own org valuation_comparables"
  on public.valuation_comparables for update
  using (org_id in (select org_id from public.memberships where user_id = auth.uid()));

create policy "Users can delete own org valuation_comparables"
  on public.valuation_comparables for delete
  using (org_id in (select org_id from public.memberships where user_id = auth.uid()));

create index idx_valuation_comparables_property on public.valuation_comparables(property_id);
create index idx_valuation_comparables_org on public.valuation_comparables(org_id);

-- ── valuation_history ────────────────────────────────────────────────────────
create table if not exists public.valuation_history (
  id                 uuid primary key default gen_random_uuid(),
  property_id        uuid not null references public.properties_v2(id) on delete cascade,
  org_id             uuid not null references public.organizations(id) on delete cascade,
  valuation_date     date not null,
  value              numeric not null,
  basis_of_value     text not null default 'market_value'
                     check (basis_of_value in ('market_value','investment_value','fair_value')),
  valuer_name        text,
  valuer_firm        text,
  valuation_type     text not null default 'desktop'
                     check (valuation_type in ('desktop','drive_by','full_inspection','rics_red_book')),
  key_assumptions    text,
  esg_considerations text,
  document_url       text,
  created_at         timestamptz not null default now()
);

alter table public.valuation_history enable row level security;

create policy "Users can view own org valuation_history"
  on public.valuation_history for select
  using (org_id in (select org_id from public.memberships where user_id = auth.uid()));

create policy "Users can insert own org valuation_history"
  on public.valuation_history for insert
  with check (org_id in (select org_id from public.memberships where user_id = auth.uid()));

create policy "Users can update own org valuation_history"
  on public.valuation_history for update
  using (org_id in (select org_id from public.memberships where user_id = auth.uid()));

create policy "Users can delete own org valuation_history"
  on public.valuation_history for delete
  using (org_id in (select org_id from public.memberships where user_id = auth.uid()));

create index idx_valuation_history_property on public.valuation_history(property_id);
create index idx_valuation_history_org on public.valuation_history(org_id);
create index idx_valuation_history_date on public.valuation_history(valuation_date desc);
