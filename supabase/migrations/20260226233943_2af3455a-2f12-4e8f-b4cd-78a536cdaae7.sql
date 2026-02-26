
-- ============================================================
-- Compliance v2 Schema
-- Links to properties_v2, org-scoped RLS
-- ============================================================

-- 1. compliance_documents_v2
CREATE TABLE public.compliance_documents_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  property_id UUID NOT NULL REFERENCES public.properties_v2(id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'gas_safety_certificate',
    'epc',
    'eicr',
    'fire_risk_assessment',
    'hmo_licence',
    'selective_licence',
    'buildings_insurance',
    'landlord_liability_insurance',
    'rent_guarantee_insurance',
    'legionella_risk_assessment',
    'asbestos_survey',
    'pat_testing',
    'emergency_lighting_cert',
    'fire_alarm_cert',
    'smoke_co_alarm_cert',
    'furniture_fire_safety',
    'energy_performance_certificate',
    'planning_permission',
    'building_regs_completion',
    'other'
  )),
  issue_date DATE NOT NULL,
  expiry_date DATE,
  issuer_name TEXT,
  certificate_number TEXT,
  file_url TEXT,
  file_name TEXT,
  file_hash TEXT,
  supersedes_id UUID REFERENCES public.compliance_documents_v2(id),
  is_current BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'expiring_soon', 'critical', 'expired', 'missing', 'not_required')),
  ai_extracted BOOLEAN DEFAULT false,
  ai_confidence_score NUMERIC(3,2),
  cost NUMERIC(8,2),
  contractor_id UUID REFERENCES public.contractors(id),
  next_review_date DATE,
  notes TEXT,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_compliance_docs_v2_org ON public.compliance_documents_v2(org_id);
CREATE INDEX idx_compliance_docs_v2_property ON public.compliance_documents_v2(property_id);
CREATE INDEX idx_compliance_docs_v2_type ON public.compliance_documents_v2(document_type);
CREATE INDEX idx_compliance_docs_v2_expiry ON public.compliance_documents_v2(expiry_date);
CREATE INDEX idx_compliance_docs_v2_status ON public.compliance_documents_v2(status);
CREATE INDEX idx_compliance_docs_v2_current ON public.compliance_documents_v2(is_current);

-- 2. compliance_requirements_v2
CREATE TABLE public.compliance_requirements_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  property_id UUID NOT NULL REFERENCES public.properties_v2(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'gas_safety_certificate',
    'epc',
    'eicr',
    'fire_risk_assessment',
    'hmo_licence',
    'selective_licence',
    'buildings_insurance',
    'landlord_liability_insurance',
    'rent_guarantee_insurance',
    'legionella_risk_assessment',
    'asbestos_survey',
    'pat_testing',
    'emergency_lighting_cert',
    'fire_alarm_cert',
    'smoke_co_alarm_cert',
    'furniture_fire_safety'
  )),
  is_required BOOLEAN DEFAULT true,
  requirement_reason TEXT,
  override_reason TEXT,
  review_frequency_months INTEGER,
  lead_time_days INTEGER DEFAULT 30,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, document_type)
);

CREATE INDEX idx_compliance_reqs_v2_org ON public.compliance_requirements_v2(org_id);
CREATE INDEX idx_compliance_reqs_v2_property ON public.compliance_requirements_v2(property_id);

-- 3. compliance_contractors_v2 (org-scoped)
CREATE TABLE public.compliance_contractors_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  service_types TEXT[] NOT NULL DEFAULT '{}',
  gas_safe_number TEXT,
  niceic_number TEXT,
  coverage_area TEXT,
  is_preferred BOOLEAN DEFAULT false,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_compliance_contractors_v2_org ON public.compliance_contractors_v2(org_id);

-- ============================================================
-- RLS Policies (org-scoped)
-- ============================================================

ALTER TABLE public.compliance_documents_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_requirements_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_contractors_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own org compliance_documents_v2"
  ON public.compliance_documents_v2 FOR ALL
  USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

CREATE POLICY "Users can manage own org compliance_requirements_v2"
  ON public.compliance_requirements_v2 FOR ALL
  USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

CREATE POLICY "Users can manage own org compliance_contractors_v2"
  ON public.compliance_contractors_v2 FOR ALL
  USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

-- ============================================================
-- Auto-generate compliance requirements function
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_compliance_requirements_v2(target_property_id UUID)
RETURNS void AS $$
DECLARE
  prop RECORD;
BEGIN
  SELECT * INTO prop FROM public.properties_v2 WHERE id = target_property_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Universal requirements
  INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
  VALUES
    (prop.org_id, target_property_id, 'epc', true, 'Required for all rental properties', 120, 30),
    (prop.org_id, target_property_id, 'eicr', true, 'Required for all rental properties (5-year cycle)', 60, 30),
    (prop.org_id, target_property_id, 'buildings_insurance', true, 'Required for all properties', 12, 30),
    (prop.org_id, target_property_id, 'smoke_co_alarm_cert', true, 'Required under Smoke and CO Alarm Regulations', 12, 14)
  ON CONFLICT (property_id, document_type) DO NOTHING;

  -- Gas safety (conditional)
  IF prop.has_gas_supply IS TRUE THEN
    INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
    VALUES (prop.org_id, target_property_id, 'gas_safety_certificate', true, 'Gas supply present - annual CP12 required', 12, 30)
    ON CONFLICT (property_id, document_type) DO NOTHING;
  ELSE
    INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, override_reason)
    VALUES (prop.org_id, target_property_id, 'gas_safety_certificate', false, 'Gas Safety Regulations', 'No gas supply to property')
    ON CONFLICT (property_id, document_type) DO UPDATE SET is_required = false, override_reason = 'No gas supply to property';
  END IF;

  -- HMO-specific
  IF prop.property_type IN ('hmo_licensed', 'hmo_mandatory') THEN
    INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
    VALUES
      (prop.org_id, target_property_id, 'hmo_licence', true, 'HMO property requires licence', 60, 90),
      (prop.org_id, target_property_id, 'fire_risk_assessment', true, 'Required for all HMOs', 12, 30),
      (prop.org_id, target_property_id, 'emergency_lighting_cert', true, 'Required for all HMOs', 12, 30),
      (prop.org_id, target_property_id, 'fire_alarm_cert', true, 'Required for all HMOs', 12, 30),
      (prop.org_id, target_property_id, 'furniture_fire_safety', true, 'Required for furnished HMO rooms', 0, 14),
      (prop.org_id, target_property_id, 'pat_testing', true, 'Recommended for HMOs with communal appliances', 12, 30),
      (prop.org_id, target_property_id, 'legionella_risk_assessment', true, 'Required for HMOs with shared water systems', 24, 30),
      (prop.org_id, target_property_id, 'asbestos_survey', true, 'Required for HMOs built before 2000', 0, 30),
      (prop.org_id, target_property_id, 'landlord_liability_insurance', true, 'Strongly recommended for HMOs', 12, 30)
    ON CONFLICT (property_id, document_type) DO NOTHING;
  END IF;

  -- Single let
  IF prop.property_type = 'single_let' THEN
    INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
    VALUES
      (prop.org_id, target_property_id, 'fire_risk_assessment', false, 'Not mandatory for single lets', NULL, NULL),
      (prop.org_id, target_property_id, 'legionella_risk_assessment', true, 'Recommended for all rental properties', 24, 30),
      (prop.org_id, target_property_id, 'landlord_liability_insurance', true, 'Strongly recommended', 12, 30)
    ON CONFLICT (property_id, document_type) DO NOTHING;
  END IF;

  -- Listed building notes
  IF prop.listing_grade != 'none' THEN
    UPDATE public.compliance_requirements_v2
    SET notes = 'Listed building (' || prop.listing_grade || ') - check alternative compliance routes with conservation officer'
    WHERE property_id = target_property_id
      AND document_type IN ('fire_alarm_cert', 'emergency_lighting_cert', 'eicr');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Trigger to auto-generate on property create/update
CREATE OR REPLACE FUNCTION public.trigger_generate_compliance_reqs_v2()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.generate_compliance_requirements_v2(NEW.id);
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.property_type IS DISTINCT FROM NEW.property_type
      OR OLD.has_gas_supply IS DISTINCT FROM NEW.has_gas_supply
      OR OLD.listing_grade IS DISTINCT FROM NEW.listing_grade THEN
      PERFORM public.generate_compliance_requirements_v2(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER trigger_auto_compliance_reqs_v2
AFTER INSERT OR UPDATE ON public.properties_v2
FOR EACH ROW EXECUTE FUNCTION public.trigger_generate_compliance_reqs_v2();

-- ============================================================
-- Status refresh function
-- ============================================================

CREATE OR REPLACE FUNCTION public.refresh_compliance_statuses_v2()
RETURNS void AS $$
BEGIN
  UPDATE public.compliance_documents_v2
  SET status = CASE
    WHEN expiry_date IS NULL THEN 'valid'
    WHEN expiry_date < current_date THEN 'expired'
    WHEN expiry_date <= current_date + interval '30 days' THEN 'critical'
    WHEN expiry_date <= current_date + interval '90 days' THEN 'expiring_soon'
    ELSE 'valid'
  END,
  updated_at = now()
  WHERE is_current = true
    AND status != 'not_required';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- ============================================================
-- Compliance Matrix View (security_invoker)
-- ============================================================

CREATE OR REPLACE VIEW public.compliance_matrix_v2
WITH (security_invoker = true) AS
SELECT
  cr.id AS requirement_id,
  cr.org_id,
  cr.property_id,
  p.address_line_1 || ', ' || p.postcode AS property_address,
  p.property_type,
  le.entity_name,
  cr.document_type,
  cr.is_required,
  cr.override_reason,
  cr.review_frequency_months,
  cr.lead_time_days,
  cd.id AS document_id,
  cd.issue_date,
  cd.expiry_date,
  cd.issuer_name,
  cd.certificate_number,
  cd.file_url,
  cd.ai_extracted,
  cd.cost,
  cd.notes AS document_notes,
  CASE
    WHEN cr.is_required = false THEN 'not_required'
    WHEN cd.id IS NULL THEN 'missing'
    WHEN cd.expiry_date IS NOT NULL AND cd.expiry_date < current_date THEN 'expired'
    WHEN cd.expiry_date IS NOT NULL AND cd.expiry_date <= current_date + interval '30 days' THEN 'critical'
    WHEN cd.expiry_date IS NOT NULL AND cd.expiry_date <= current_date + interval '90 days' THEN 'expiring_soon'
    ELSE 'valid'
  END AS calculated_status,
  CASE
    WHEN cr.is_required = false THEN NULL
    WHEN cd.id IS NULL THEN NULL
    WHEN cd.expiry_date IS NULL THEN NULL
    ELSE cd.expiry_date - current_date
  END AS days_remaining,
  CASE
    WHEN cr.is_required = false THEN 9999
    WHEN cd.id IS NULL THEN -1
    WHEN cd.expiry_date IS NOT NULL AND cd.expiry_date < current_date THEN -(current_date - cd.expiry_date)::integer
    WHEN cd.expiry_date IS NOT NULL THEN (cd.expiry_date - current_date)::integer
    ELSE 9998
  END AS urgency_score
FROM public.compliance_requirements_v2 cr
JOIN public.properties_v2 p ON p.id = cr.property_id
LEFT JOIN public.legal_entities le ON le.id = p.entity_id
LEFT JOIN public.compliance_documents_v2 cd
  ON cd.property_id = cr.property_id
  AND cd.document_type = cr.document_type
  AND cd.is_current = true
ORDER BY urgency_score ASC;

-- ============================================================
-- Portfolio Compliance Score View (security_invoker)
-- ============================================================

CREATE OR REPLACE VIEW public.portfolio_compliance_score_v2
WITH (security_invoker = true) AS
SELECT
  count(*) FILTER (WHERE is_required = true) AS total_required,
  count(*) FILTER (WHERE is_required = true AND calculated_status = 'valid') AS total_valid,
  count(*) FILTER (WHERE is_required = true AND calculated_status = 'expiring_soon') AS total_expiring_soon,
  count(*) FILTER (WHERE is_required = true AND calculated_status = 'critical') AS total_critical,
  count(*) FILTER (WHERE is_required = true AND calculated_status = 'expired') AS total_expired,
  count(*) FILTER (WHERE is_required = true AND calculated_status = 'missing') AS total_missing,
  CASE
    WHEN count(*) FILTER (WHERE is_required = true) = 0 THEN 100
    ELSE round(
      count(*) FILTER (WHERE is_required = true AND calculated_status = 'valid')::numeric /
      count(*) FILTER (WHERE is_required = true)::numeric * 100, 1
    )
  END AS compliance_score_pct
FROM public.compliance_matrix_v2;

-- ============================================================
-- Updated_at triggers
-- ============================================================

CREATE TRIGGER update_compliance_documents_v2_updated_at
  BEFORE UPDATE ON public.compliance_documents_v2
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_requirements_v2_updated_at
  BEFORE UPDATE ON public.compliance_requirements_v2
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_contractors_v2_updated_at
  BEFORE UPDATE ON public.compliance_contractors_v2
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Storage bucket for compliance documents v2
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('compliance-documents', 'compliance-documents', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload compliance docs v2"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'compliance-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read compliance docs v2"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'compliance-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete compliance docs v2"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'compliance-documents' AND auth.uid() IS NOT NULL);
