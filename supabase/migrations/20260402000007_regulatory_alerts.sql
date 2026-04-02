-- Regulatory alerts: AI-scanned UK housing law changes
create table if not exists public.regulatory_alerts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  title         text not null,
  category      text not null check (category in (
    'housing_act', 'hmo_regs', 'fire_safety', 'epc_regs',
    'tenancy_law', 'tax_changes', 'licensing', 'planning', 'other'
  )),
  severity      text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  summary       text not null,
  details       text,
  source_url    text,
  effective_date date,
  affects_property_types text[],
  recommended_actions    jsonb,
  acknowledged_by        uuid references auth.users(id),
  acknowledged_at        timestamptz,
  dismissed              boolean not null default false,
  created_at             timestamptz not null default now()
);

-- Indexes
create index idx_regulatory_alerts_org on public.regulatory_alerts(org_id);
create index idx_regulatory_alerts_severity on public.regulatory_alerts(org_id, severity, created_at desc);
create index idx_regulatory_alerts_category on public.regulatory_alerts(org_id, category);
create index idx_regulatory_alerts_dismissed on public.regulatory_alerts(org_id, dismissed);
create unique index idx_regulatory_alerts_dedup on public.regulatory_alerts(org_id, title, effective_date);

-- RLS
alter table public.regulatory_alerts enable row level security;

create policy "Org members can view regulatory alerts"
  on public.regulatory_alerts for select
  using (
    org_id in (
      select org_id from public.memberships where user_id = auth.uid()
    )
  );

create policy "Org members can insert regulatory alerts"
  on public.regulatory_alerts for insert
  with check (
    org_id in (
      select org_id from public.memberships where user_id = auth.uid()
    )
  );

create policy "Org members can update regulatory alerts"
  on public.regulatory_alerts for update
  using (
    org_id in (
      select org_id from public.memberships where user_id = auth.uid()
    )
  );

-- Service role bypass for cron
create policy "Service role full access on regulatory alerts"
  on public.regulatory_alerts for all
  using (auth.role() = 'service_role');
