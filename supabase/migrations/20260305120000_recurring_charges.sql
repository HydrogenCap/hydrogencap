-- Recurring charges table for per-tenancy fees (parking, cleaning, internet etc.)
CREATE TABLE public.recurring_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants_v2(id) ON DELETE CASCADE,
  tenancy_id UUID REFERENCES public.tenancy_agreements(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_manage_recurring_charges"
  ON public.recurring_charges
  FOR ALL
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE INDEX idx_recurring_charges_tenant_id ON public.recurring_charges(tenant_id);
CREATE INDEX idx_recurring_charges_org_id ON public.recurring_charges(org_id);
