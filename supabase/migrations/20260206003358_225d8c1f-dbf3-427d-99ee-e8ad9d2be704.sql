-- ============================================
-- INBOUND EMAIL TRACKING (for future email integration)
-- ============================================

CREATE TABLE IF NOT EXISTS public.inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Email details
  message_id TEXT UNIQUE,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Attachments (stored as JSON array)
  attachments JSONB DEFAULT '[]',
  
  -- AI Processing
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN (
    'pending', 'processing', 'processed', 'failed', 'manual_review'
  )),
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  
  -- AI Extraction Results
  ai_extraction JSONB,
  
  -- Matching
  matched_property_id UUID REFERENCES public.properties(id),
  matched_job_id UUID REFERENCES public.contractor_jobs(id),
  matched_compliance_item_id UUID REFERENCES public.compliance_items(id),
  match_confidence TEXT CHECK (match_confidence IN ('high', 'medium', 'low', 'none')),
  
  -- Actions taken
  document_created_id UUID REFERENCES public.documents(id),
  compliance_updated BOOLEAN DEFAULT false,
  job_updated BOOLEAN DEFAULT false,
  
  -- Manual review
  requires_review BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbound_emails_org ON public.inbound_emails(org_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_status ON public.inbound_emails(processing_status);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_job ON public.inbound_emails(matched_job_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_property ON public.inbound_emails(matched_property_id);

ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view inbound emails"
ON public.inbound_emails
FOR ALL
USING (public.user_has_org_access(org_id));

-- ============================================
-- CERTIFICATE TYPE MAPPINGS
-- ============================================

CREATE TABLE IF NOT EXISTS public.certificate_type_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What AI might detect
  ai_detected_type TEXT NOT NULL UNIQUE,
  keywords TEXT[],
  
  -- Maps to
  compliance_type TEXT NOT NULL,
  document_category TEXT NOT NULL,
  
  -- Validation
  has_expiry BOOLEAN DEFAULT true,
  typical_validity_years INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed certificate type mappings
INSERT INTO public.certificate_type_mappings 
(ai_detected_type, keywords, compliance_type, document_category, has_expiry, typical_validity_years) VALUES
('gas_safety_certificate', ARRAY['gas safety', 'cp12', 'landlord gas safety record', 'lgsr'], 'Gas Safety Certificate (CP12)', 'gas-safety', true, 1),
('electrical_certificate', ARRAY['eicr', 'electrical installation condition report', 'electrical safety'], 'Electrical Safety Certificate (EICR)', 'eicr', true, 5),
('epc_certificate', ARRAY['epc', 'energy performance certificate', 'energy rating'], 'EPC', 'epc', true, 10),
('pat_testing', ARRAY['pat', 'portable appliance testing', 'pat testing'], 'PAT Testing', 'pat-testing', true, 1),
('fire_alarm_certificate', ARRAY['fire alarm', 'fire detection', 'smoke alarm'], 'Fire Alarm Certificate', 'fire-safety', true, 1),
('emergency_lighting_certificate', ARRAY['emergency lighting', 'emergency light test'], 'Emergency Lighting Certificate', 'fire-safety', true, 1),
('fire_suppression_certificate', ARRAY['fire extinguisher', 'extinguisher service', 'fire suppression'], 'Fire Suppression System Certificate', 'fire-safety', true, 1),
('fire_risk_assessment', ARRAY['fire risk assessment', 'fra'], 'Fire Risk Assessment (FRA)', 'fire-safety', true, 1),
('legionella_assessment', ARRAY['legionella', 'water hygiene', 'water risk assessment'], 'Legionella Risk Assessment', 'legionella', true, 2),
('asbestos_survey', ARRAY['asbestos', 'asbestos survey', 'asbestos register'], 'Asbestos Survey', 'asbestos', false, NULL),
('hmo_licence', ARRAY['hmo licence', 'hmo license', 'house in multiple occupation'], 'HMO Licence', 'hmo-licence', true, 5),
('building_insurance', ARRAY['insurance certificate', 'insurance schedule', 'policy schedule'], 'Insurance Schedule', 'insurance', true, 1)
ON CONFLICT (ai_detected_type) DO NOTHING;