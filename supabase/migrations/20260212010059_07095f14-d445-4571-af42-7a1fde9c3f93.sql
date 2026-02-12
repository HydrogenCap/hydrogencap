
-- ============================================================
-- PHASE 2: VOID PERIOD TRACKING
-- ============================================================

CREATE TABLE public.void_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  start_date DATE NOT NULL,
  end_date DATE,
  reason TEXT CHECK (reason IN ('between_tenants', 'refurbishment', 'sale_preparation', 'legal_dispute', 'other')),
  reason_notes TEXT,
  estimated_monthly_cost NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.void_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org void periods"
ON public.void_periods FOR ALL
USING (public.user_has_org_access(org_id))
WITH CHECK (public.user_has_org_access(org_id));

CREATE INDEX idx_void_periods_property ON public.void_periods(property_id);
CREATE INDEX idx_void_periods_org ON public.void_periods(org_id);

CREATE TRIGGER update_void_periods_updated_at
BEFORE UPDATE ON public.void_periods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PHASE 2: LEASEHOLD DETAILS
-- ============================================================

CREATE TABLE public.leasehold_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE UNIQUE,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  ground_rent_annual NUMERIC(10,2),
  ground_rent_review_date DATE,
  ground_rent_escalation TEXT,
  service_charge_annual NUMERIC(10,2),
  service_charge_review_date DATE,
  managing_agent TEXT,
  managing_agent_phone TEXT,
  managing_agent_email TEXT,
  lease_start_date DATE,
  original_term_years INTEGER,
  next_review_date DATE,
  section_20_notices_pending BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leasehold_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org leasehold details"
ON public.leasehold_details FOR ALL
USING (public.user_has_org_access(org_id))
WITH CHECK (public.user_has_org_access(org_id));

CREATE INDEX idx_leasehold_details_property ON public.leasehold_details(property_id);
CREATE INDEX idx_leasehold_details_org ON public.leasehold_details(org_id);

CREATE TRIGGER update_leasehold_details_updated_at
BEFORE UPDATE ON public.leasehold_details
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
