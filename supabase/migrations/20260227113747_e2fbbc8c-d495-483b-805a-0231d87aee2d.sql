
-- Phase 2.5: AI Document Auto-Classification

-- 1. Extraction templates table
CREATE TABLE IF NOT EXISTS public.ai_extraction_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL UNIQUE,
  display_name text NOT NULL,
  extraction_fields jsonb NOT NULL,
  classification_keywords text[] NOT NULL DEFAULT '{}'::text[],
  typical_issuers text[] DEFAULT '{}'::text[],
  has_expiry boolean DEFAULT true,
  default_validity_months integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_extraction_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.ai_extraction_templates FOR SELECT USING (auth.uid() IS NOT NULL);

-- 2. Seed extraction templates
INSERT INTO public.ai_extraction_templates (document_type, display_name, extraction_fields, classification_keywords, typical_issuers, has_expiry, default_validity_months) VALUES
('gas_safety_certificate', 'Gas Safety Certificate (CP12)',
 '{"fields":[{"key":"certificate_number","label":"Certificate Number","type":"text","required":false},{"key":"issue_date","label":"Date of Inspection","type":"date","required":true},{"key":"expiry_date","label":"Expiry Date","type":"date","required":true},{"key":"engineer_name","label":"Engineer Name","type":"text","required":false},{"key":"gas_safe_number","label":"Gas Safe Number","type":"text","required":false},{"key":"property_address","label":"Property Address","type":"address","required":true},{"key":"appliances_tested","label":"Appliances Tested","type":"number","required":false},{"key":"result","label":"Overall Result","type":"text","required":false}]}',
 ARRAY['gas safety','cp12','gas safe','landlord gas safety record','lgsr'], ARRAY['British Gas','HomeServe'], true, 12),
('epc_certificate', 'Energy Performance Certificate (EPC)',
 '{"fields":[{"key":"certificate_number","label":"Certificate Reference","type":"text","required":true},{"key":"issue_date","label":"Date of Assessment","type":"date","required":true},{"key":"expiry_date","label":"Valid Until","type":"date","required":true},{"key":"property_address","label":"Property Address","type":"address","required":true},{"key":"energy_rating","label":"Energy Rating (A-G)","type":"text","required":true},{"key":"energy_score","label":"Score (1-100)","type":"number","required":false},{"key":"assessor_name","label":"Assessor Name","type":"text","required":false}]}',
 ARRAY['energy performance','epc','energy rating','energy efficiency','energy certificate'], ARRAY['Elmhurst Energy','Stroma','Quidos'], true, 120),
('electrical_certificate', 'Electrical Installation Condition Report (EICR)',
 '{"fields":[{"key":"certificate_number","label":"Report Reference","type":"text","required":false},{"key":"issue_date","label":"Date of Inspection","type":"date","required":true},{"key":"expiry_date","label":"Next Inspection Due","type":"date","required":true},{"key":"property_address","label":"Property Address","type":"address","required":true},{"key":"electrician_name","label":"Inspector Name","type":"text","required":false},{"key":"overall_result","label":"Condition","type":"text","required":true},{"key":"c1_codes","label":"C1 Count","type":"number","required":false},{"key":"c2_codes","label":"C2 Count","type":"number","required":false}]}',
 ARRAY['electrical installation','eicr','condition report','periodic inspection','niceic','bs 7671'], ARRAY['NICEIC','NAPIT','ELECSA'], true, 60),
('fire_risk_assessment', 'Fire Risk Assessment',
 '{"fields":[{"key":"certificate_number","label":"Report Reference","type":"text","required":false},{"key":"issue_date","label":"Date of Assessment","type":"date","required":true},{"key":"expiry_date","label":"Review Date","type":"date","required":true},{"key":"property_address","label":"Property Address","type":"address","required":true},{"key":"assessor_name","label":"Assessor","type":"text","required":false},{"key":"risk_level","label":"Risk Level","type":"text","required":false},{"key":"action_items_count","label":"Action Items","type":"number","required":false}]}',
 ARRAY['fire risk','fra','fire safety','fire assessment','regulatory reform'], ARRAY[]::text[], true, 12),
('hmo_licence', 'HMO Licence',
 '{"fields":[{"key":"certificate_number","label":"Licence Number","type":"text","required":true},{"key":"issue_date","label":"Grant Date","type":"date","required":true},{"key":"expiry_date","label":"Expiry Date","type":"date","required":true},{"key":"property_address","label":"Property Address","type":"address","required":true},{"key":"licence_holder","label":"Licence Holder","type":"text","required":false},{"key":"max_occupants","label":"Max Occupants","type":"number","required":false},{"key":"council_name","label":"Issuing Council","type":"text","required":false}]}',
 ARRAY['hmo licence','house in multiple occupation','mandatory licence','selective licence'], ARRAY[]::text[], true, 60),
('building_insurance', 'Buildings Insurance',
 '{"fields":[{"key":"certificate_number","label":"Policy Number","type":"text","required":true},{"key":"issue_date","label":"Cover Start Date","type":"date","required":true},{"key":"expiry_date","label":"Renewal Date","type":"date","required":true},{"key":"property_address","label":"Property Address","type":"address","required":true},{"key":"insurer_name","label":"Insurance Provider","type":"text","required":false},{"key":"sum_insured","label":"Sum Insured","type":"number","required":false},{"key":"premium","label":"Annual Premium","type":"number","required":false}]}',
 ARRAY['buildings insurance','property insurance','landlord insurance','schedule of insurance'], ARRAY['Aviva','AXA','Zurich','Just Landlords','Rentguard'], true, 12),
('fire_alarm_certificate', 'Fire Alarm Certificate',
 '{"fields":[{"key":"certificate_number","label":"Certificate Number","type":"text","required":false},{"key":"issue_date","label":"Date of Test","type":"date","required":true},{"key":"expiry_date","label":"Next Test Due","type":"date","required":true},{"key":"property_address","label":"Property Address","type":"address","required":true},{"key":"engineer_name","label":"Engineer","type":"text","required":false},{"key":"system_type","label":"System Type/Grade","type":"text","required":false}]}',
 ARRAY['fire alarm','fire detection','bs 5839','alarm test'], ARRAY[]::text[], true, 12),
('emergency_lighting_certificate', 'Emergency Lighting Certificate',
 '{"fields":[{"key":"certificate_number","label":"Certificate Number","type":"text","required":false},{"key":"issue_date","label":"Date of Test","type":"date","required":true},{"key":"expiry_date","label":"Next Test Due","type":"date","required":true},{"key":"property_address","label":"Property Address","type":"address","required":true},{"key":"engineer_name","label":"Engineer","type":"text","required":false},{"key":"luminaires_tested","label":"Luminaires Tested","type":"number","required":false}]}',
 ARRAY['emergency lighting','emergency light','bs 5266'], ARRAY[]::text[], true, 12),
('pat_testing', 'PAT Testing Certificate',
 '{"fields":[{"key":"certificate_number","label":"Report Reference","type":"text","required":false},{"key":"issue_date","label":"Date of Testing","type":"date","required":true},{"key":"expiry_date","label":"Next Test Due","type":"date","required":true},{"key":"property_address","label":"Property Address","type":"address","required":true},{"key":"items_tested","label":"Items Tested","type":"number","required":false},{"key":"items_failed","label":"Items Failed","type":"number","required":false}]}',
 ARRAY['portable appliance','pat test','pat testing','appliance testing'], ARRAY[]::text[], true, 12),
('legionella_assessment', 'Legionella Risk Assessment',
 '{"fields":[{"key":"certificate_number","label":"Report Reference","type":"text","required":false},{"key":"issue_date","label":"Date of Assessment","type":"date","required":true},{"key":"expiry_date","label":"Review Date","type":"date","required":true},{"key":"property_address","label":"Property Address","type":"address","required":true},{"key":"assessor_name","label":"Assessor","type":"text","required":false},{"key":"risk_level","label":"Risk Level","type":"text","required":false}]}',
 ARRAY['legionella','legionnaires','water hygiene','water risk assessment'], ARRAY[]::text[], true, 24);

-- 3. Add auto-filing columns to documents table
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS auto_filed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_file_confidence numeric(3,2),
  ADD COLUMN IF NOT EXISTS processing_time_ms integer,
  ADD COLUMN IF NOT EXISTS ai_tokens_used integer,
  ADD COLUMN IF NOT EXISTS ai_model text,
  ADD COLUMN IF NOT EXISTS extracted_data jsonb,
  ADD COLUMN IF NOT EXISTS validation_errors text[],
  ADD COLUMN IF NOT EXISTS validation_warnings text[];

-- 4. App settings table (org-scoped)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  setting_key text NOT NULL,
  setting_value text,
  description text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, setting_key)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own org settings" ON public.app_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() AND org_id = app_settings.org_id)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() AND org_id = app_settings.org_id)
  );

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_documents_auto_filed ON public.documents(auto_filed) WHERE auto_filed = true;
CREATE INDEX IF NOT EXISTS idx_documents_extraction_status ON public.documents(extraction_status);
CREATE INDEX IF NOT EXISTS idx_documents_review_status ON public.documents(review_status);
