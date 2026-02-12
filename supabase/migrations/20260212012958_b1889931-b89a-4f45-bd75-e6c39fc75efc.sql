
-- Tenant Portal Invites
CREATE TABLE public.tenant_portal_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenancy_id UUID NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at TIMESTAMPTZ,
  UNIQUE(token)
);

ALTER TABLE public.tenant_portal_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage tenant invites"
  ON public.tenant_portal_invites FOR ALL
  USING (public.user_has_org_access(org_id));

-- Tenant Portal Access
CREATE TABLE public.tenant_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenancy_id UUID NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_id UUID REFERENCES public.tenant_portal_invites(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  can_view_rent BOOLEAN NOT NULL DEFAULT true,
  can_view_documents BOOLEAN NOT NULL DEFAULT true,
  can_submit_maintenance BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, tenancy_id)
);

ALTER TABLE public.tenant_portal_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage tenant access"
  ON public.tenant_portal_access FOR ALL
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Tenants can read own access"
  ON public.tenant_portal_access FOR SELECT
  USING (auth.uid() = user_id AND revoked_at IS NULL);

-- Security definer functions
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(check_tenancy_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_portal_access
    WHERE user_id = auth.uid()
    AND tenancy_id = check_tenancy_id
    AND revoked_at IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.user_is_tenant_portal_user()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_portal_access
    WHERE user_id = auth.uid()
    AND revoked_at IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_org_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT org_id FROM public.tenant_portal_access
  WHERE user_id = auth.uid()
  AND revoked_at IS NULL
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_has_tenant_access_by_tenant_id(check_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_portal_access
    WHERE user_id = auth.uid()
    AND tenant_id = check_tenant_id
    AND revoked_at IS NULL
  )
$$;

-- RLS policies for existing tables
CREATE POLICY "Tenants can view own rent schedule"
  ON public.rent_schedule FOR SELECT
  USING (public.user_has_tenant_access(tenancy_id));

CREATE POLICY "Tenants can view own rent payments"
  ON public.rent_payments FOR SELECT
  USING (public.user_has_tenant_access(tenancy_id));

CREATE POLICY "Tenants can view own tenancy compliance"
  ON public.tenancy_compliance_items FOR SELECT
  USING (public.user_has_tenant_access(tenancy_id));

CREATE POLICY "Tenants can view own maintenance requests"
  ON public.maintenance_requests FOR SELECT
  USING (public.user_has_tenant_access_by_tenant_id(tenant_id));

CREATE POLICY "Tenants can create maintenance requests"
  ON public.maintenance_requests FOR INSERT
  WITH CHECK (public.user_has_tenant_access_by_tenant_id(tenant_id));
