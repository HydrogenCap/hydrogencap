create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  name text not null,
  filters_json jsonb not null default '{}'::jsonb,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saved_views_org_scope on public.saved_views(org_id, scope);
create index if not exists idx_saved_views_user on public.saved_views(user_id);

alter table public.saved_views enable row level security;

create policy "saved_views_select_own_or_shared"
  on public.saved_views for select to authenticated
  using (
    user_id = auth.uid()
    or (is_shared = true and public.user_has_org_access(org_id))
  );

create policy "saved_views_insert_own"
  on public.saved_views for insert to authenticated
  with check (user_id = auth.uid() and public.user_has_org_access(org_id));

create policy "saved_views_update_own"
  on public.saved_views for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "saved_views_delete_own"
  on public.saved_views for delete to authenticated
  using (user_id = auth.uid());

create trigger saved_views_set_updated_at
  before update on public.saved_views
  for each row execute function public.update_updated_at_column();