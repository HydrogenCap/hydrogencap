-- Tenant Lifecycle Management
-- Adds payment scoring columns, tenant notices, and lifecycle events

-- ============================================================
-- 1. Add payment scoring + benefit columns to tenants_v2
-- ============================================================
ALTER TABLE public.tenants_v2
  ADD COLUMN IF NOT EXISTS payment_score NUMERIC(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS on_time_payments INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_payments INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missed_payments INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS housing_benefit_amount NUMERIC(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS universal_credit NUMERIC(8,2) DEFAULT NULL;

-- ============================================================
-- 2. Tenant Notices table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants_v2(id) ON DELETE CASCADE,
  tenancy_id UUID REFERENCES public.tenancy_agreements(id) ON DELETE SET NULL,
  notice_type TEXT NOT NULL CHECK (notice_type IN (
    'section_8', 'section_13', 'section_21',
    'rent_arrears_warning', 'property_access',
    'welcome', 'end_of_tenancy', 'custom'
  )),
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  served_method TEXT CHECK (served_method IN (
    'hand_delivery', 'first_class_post', 'recorded_delivery',
    'email', 'portal', 'other'
  )),
  served_at TIMESTAMPTZ DEFAULT NULL,
  proof_of_service TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'sent', 'served', 'acknowledged', 'expired', 'withdrawn'
  )),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_notices_org ON public.tenant_notices(org_id);
CREATE INDEX IF NOT EXISTS idx_tenant_notices_tenant ON public.tenant_notices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_notices_tenancy ON public.tenant_notices(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_tenant_notices_status ON public.tenant_notices(status);

CREATE TRIGGER set_tenant_notices_updated_at
  BEFORE UPDATE ON public.tenant_notices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.tenant_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_manage_tenant_notices"
  ON public.tenant_notices
  FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.memberships WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. Tenant Lifecycle Events table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants_v2(id) ON DELETE CASCADE,
  tenancy_id UUID REFERENCES public.tenancy_agreements(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'application_received', 'reference_requested', 'reference_completed',
    'agreement_signed', 'moved_in', 'rent_increase',
    'notice_served', 'notice_received',
    'inspection_scheduled', 'inspection_completed',
    'complaint_received', 'complaint_resolved',
    'arrears_flagged', 'arrears_cleared',
    'moved_out', 'deposit_returned',
    'status_change', 'note', 'custom'
  )),
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_org ON public.tenant_lifecycle_events(org_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_tenant ON public.tenant_lifecycle_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_tenancy ON public.tenant_lifecycle_events(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_type ON public.tenant_lifecycle_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_created ON public.tenant_lifecycle_events(created_at DESC);

ALTER TABLE public.tenant_lifecycle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_manage_lifecycle_events"
  ON public.tenant_lifecycle_events
  FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.memberships WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );
