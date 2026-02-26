
-- ============================================
-- Tenants V2
-- ============================================
CREATE TABLE public.tenants_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  national_insurance TEXT,
  referral_source TEXT CHECK (referral_source IN ('direct', 'agent', 'council', 'housing_association', 'supported_housing', 'referral', 'online_ad')),
  tenant_type TEXT NOT NULL DEFAULT 'private' CHECK (tenant_type IN ('private', 'dss_hb', 'uc', 'council_placement', 'supported_housing')),
  status TEXT NOT NULL DEFAULT 'prospective' CHECK (status IN ('active', 'prospective', 'in_notice', 'departed', 'evicted', 'archived')),
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tenants_v2_org ON public.tenants_v2(org_id);
CREATE INDEX idx_tenants_v2_status ON public.tenants_v2(status);
CREATE INDEX idx_tenants_v2_tenant_type ON public.tenants_v2(tenant_type);
CREATE INDEX idx_tenants_v2_name ON public.tenants_v2(last_name, first_name);

CREATE TRIGGER update_tenants_v2_updated_at
  BEFORE UPDATE ON public.tenants_v2
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Tenancy Agreements
-- ============================================
CREATE TABLE public.tenancy_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants_v2(id) ON DELETE RESTRICT,
  room_id UUID NOT NULL REFERENCES public.rooms_v2(id) ON DELETE RESTRICT,
  property_id UUID NOT NULL REFERENCES public.properties_v2(id) ON DELETE RESTRICT,
  tenancy_type TEXT NOT NULL DEFAULT 'ast' CHECK (tenancy_type IN ('ast', 'licence_to_occupy', 'contractual_periodic', 'statutory_periodic', 'company_let')),
  start_date DATE NOT NULL,
  initial_end_date DATE,
  actual_end_date DATE,
  rent_amount_pcm NUMERIC(8,2) NOT NULL,
  rent_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (rent_frequency IN ('weekly', 'fortnightly', 'four_weekly', 'monthly')),
  deposit_amount NUMERIC(8,2),
  deposit_scheme TEXT CHECK (deposit_scheme IN ('dps', 'mydeposits', 'tds', 'none')),
  deposit_reference TEXT,
  deposit_protected_date DATE,
  prescribed_info_served_date DATE,
  how_to_rent_served_date DATE,
  is_periodic BOOLEAN DEFAULT false,
  notice_served_date DATE,
  notice_type TEXT CHECK (notice_type IN ('section_21', 'section_8', 'tenant_notice', 'mutual', 'none')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'notice_period', 'ended', 'terminated')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tenancy_agreements_org ON public.tenancy_agreements(org_id);
CREATE INDEX idx_tenancy_agreements_tenant_id ON public.tenancy_agreements(tenant_id);
CREATE INDEX idx_tenancy_agreements_room_id ON public.tenancy_agreements(room_id);
CREATE INDEX idx_tenancy_agreements_property_id ON public.tenancy_agreements(property_id);
CREATE INDEX idx_tenancy_agreements_status ON public.tenancy_agreements(status);
CREATE INDEX idx_tenancy_agreements_start_date ON public.tenancy_agreements(start_date);

CREATE TRIGGER update_tenancy_agreements_updated_at
  BEFORE UPDATE ON public.tenancy_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Auto-sync room occupancy from tenancy agreements
-- ============================================
CREATE OR REPLACE FUNCTION public.sync_room_occupancy_v2()
RETURNS trigger AS $$
DECLARE
  active_agreement RECORD;
  target_room_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_room_id := OLD.room_id;
  ELSE
    target_room_id := NEW.room_id;
  END IF;

  -- Check for active tenancy on this room
  SELECT * INTO active_agreement
  FROM public.tenancy_agreements
  WHERE room_id = target_room_id
    AND status IN ('active', 'notice_period')
    AND actual_end_date IS NULL
  ORDER BY start_date DESC
  LIMIT 1;

  IF active_agreement IS NOT NULL THEN
    UPDATE public.rooms_v2
    SET occupancy_status = CASE
          WHEN active_agreement.status = 'notice_period' THEN 'under_offer'
          ELSE 'occupied'
        END,
        current_rent_pcm = active_agreement.rent_amount_pcm,
        updated_at = now()
    WHERE id = target_room_id;
  ELSE
    UPDATE public.rooms_v2
    SET occupancy_status = 'vacant',
        updated_at = now()
    WHERE id = target_room_id;
  END IF;

  -- Handle room change on UPDATE
  IF TG_OP = 'UPDATE' AND OLD.room_id != NEW.room_id THEN
    SELECT * INTO active_agreement
    FROM public.tenancy_agreements
    WHERE room_id = OLD.room_id
      AND status IN ('active', 'notice_period')
      AND actual_end_date IS NULL
    ORDER BY start_date DESC
    LIMIT 1;

    IF active_agreement IS NOT NULL THEN
      UPDATE public.rooms_v2
      SET occupancy_status = 'occupied',
          current_rent_pcm = active_agreement.rent_amount_pcm,
          updated_at = now()
      WHERE id = OLD.room_id;
    ELSE
      UPDATE public.rooms_v2
      SET occupancy_status = 'vacant',
          updated_at = now()
      WHERE id = OLD.room_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER trigger_sync_room_occupancy_v2
  AFTER INSERT OR UPDATE OR DELETE ON public.tenancy_agreements
  FOR EACH ROW EXECUTE FUNCTION public.sync_room_occupancy_v2();

-- ============================================
-- Tenancy compliance view
-- ============================================
CREATE OR REPLACE VIEW public.tenancy_compliance_check_v2 AS
SELECT
  ta.id AS tenancy_id,
  ta.org_id,
  ta.tenant_id,
  ta.room_id,
  ta.property_id,
  t.first_name || ' ' || t.last_name AS tenant_name,
  ta.status,
  ta.deposit_amount,
  ta.deposit_scheme,
  ta.deposit_protected_date,
  ta.prescribed_info_served_date,
  ta.how_to_rent_served_date,
  CASE
    WHEN ta.deposit_amount IS NOT NULL AND ta.deposit_amount > 0 THEN
      CASE
        WHEN ta.deposit_scheme IS NULL OR ta.deposit_scheme = 'none' THEN 'missing_scheme'
        WHEN ta.deposit_protected_date IS NULL THEN 'not_protected'
        WHEN ta.prescribed_info_served_date IS NULL THEN 'no_prescribed_info'
        ELSE 'compliant'
      END
    ELSE 'no_deposit'
  END AS deposit_compliance,
  CASE
    WHEN ta.how_to_rent_served_date IS NOT NULL THEN 'served'
    ELSE 'not_served'
  END AS how_to_rent_compliance,
  CASE
    WHEN ta.deposit_amount IS NOT NULL AND ta.deposit_amount > 0 AND (
      ta.deposit_scheme IS NULL OR ta.deposit_scheme = 'none'
      OR ta.deposit_protected_date IS NULL
      OR ta.prescribed_info_served_date IS NULL
    ) THEN false
    WHEN ta.how_to_rent_served_date IS NULL THEN false
    ELSE true
  END AS section_21_ready
FROM public.tenancy_agreements ta
JOIN public.tenants_v2 t ON t.id = ta.tenant_id
WHERE ta.status IN ('active', 'notice_period');

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE public.tenants_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenancy_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage tenants_v2 in their org"
  ON public.tenants_v2 FOR ALL
  USING (public.user_has_org_access(org_id))
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Users can manage tenancy_agreements in their org"
  ON public.tenancy_agreements FOR ALL
  USING (public.user_has_org_access(org_id))
  WITH CHECK (public.user_has_org_access(org_id));
