
-- FreeAgent connections table
CREATE TABLE IF NOT EXISTS public.freeagent_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  freeagent_company_name TEXT,
  freeagent_company_url TEXT,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,
  last_sync_items_count INTEGER DEFAULT 0,
  rent_income_category_url TEXT,
  expense_category_url TEXT,
  bank_account_url TEXT,
  auto_sync_enabled BOOLEAN DEFAULT false,
  sync_rent_payments BOOLEAN DEFAULT true,
  sync_expenses BOOLEAN DEFAULT false,
  use_sandbox BOOLEAN DEFAULT false,
  connected_by UUID REFERENCES auth.users(id),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, company_id)
);

ALTER TABLE public.freeagent_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own org freeagent connections"
  ON public.freeagent_connections FOR ALL
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

-- FreeAgent sync log table
CREATE TABLE IF NOT EXISTS public.freeagent_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  freeagent_connection_id UUID NOT NULL REFERENCES public.freeagent_connections(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  freeagent_invoice_url TEXT,
  freeagent_contact_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(freeagent_connection_id, source_table, source_id)
);

ALTER TABLE public.freeagent_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org freeagent sync logs"
  ON public.freeagent_sync_log FOR ALL
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE INDEX idx_freeagent_sync_log_source ON public.freeagent_sync_log(source_table, source_id);
CREATE INDEX idx_freeagent_sync_log_connection ON public.freeagent_sync_log(freeagent_connection_id, status);

-- Updated_at trigger
CREATE TRIGGER update_freeagent_connections_updated_at
  BEFORE UPDATE ON public.freeagent_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
