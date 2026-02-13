
-- Update existing categories with descriptions and colors
UPDATE public.document_categories SET
  description = CASE slug
    WHEN 'legal-pack' THEN 'Title deeds, land registry, searches, leases'
    WHEN 'title-deeds' THEN 'Land Registry title documents and title plans'
    WHEN 'mortgage-offers' THEN 'Mortgage offer letters, KFIs, redemption statements'
    WHEN 'insurance' THEN 'Buildings insurance, landlord insurance, rent guarantee'
    WHEN 'valuations' THEN 'Property valuations, surveyor reports, RICS red book'
    WHEN 'surveys' THEN 'Homebuyer reports, building surveys, structural surveys'
    WHEN 'planning' THEN 'Planning permissions, permitted development certificates'
    WHEN 'building-control' THEN 'Building control sign-off certificates'
    WHEN 'tenancy-agreements' THEN 'ASTs, lodger agreements, licence to occupy'
    WHEN 'inventories' THEN 'Check-in/check-out inventories, schedules of condition'
    WHEN 'tenant-references' THEN 'Credit checks, employer references, landlord references'
    WHEN 'id-document' THEN 'Passports, driving licences, proof of address'
    WHEN 'tax-accounts' THEN 'Annual accounts, tax returns, management accounts'
    WHEN 'shareholder-agreement' THEN 'SHA, articles of association, partnership deeds'
    WHEN 'board-minutes' THEN 'Board meeting minutes, written resolutions'
    WHEN 'gas-safety' THEN 'Gas Safety Certificates (CP12)'
    WHEN 'eicr' THEN 'Electrical Installation Condition Reports'
    WHEN 'epc' THEN 'Energy Performance Certificates'
    WHEN 'fire-safety' THEN 'Fire alarm certs, fire risk assessments, emergency lighting'
    WHEN 'hmo-licence' THEN 'HMO licences and selective licensing'
    WHEN 'rent-statements' THEN 'Rent statements and payment summaries'
    WHEN 'share-certificates' THEN 'Share certificates and stock transfer forms'
    WHEN 'company-formation' THEN 'Certificates of incorporation, formation docs'
    ELSE description
  END,
  color = CASE
    WHEN slug IN ('legal-pack', 'title-deeds', 'planning', 'building-control') THEN 'purple'
    WHEN slug IN ('mortgage-offers', 'insurance', 'valuations', 'surveys', 'tax-accounts', 'invoices-receipts') THEN 'blue'
    WHEN slug IN ('epc', 'gas-safety', 'eicr', 'hmo-licence', 'fire-safety', 'floor-plans', 'photos') THEN 'green'
    WHEN slug IN ('tenancy-agreements', 'inventories', 'tenant-references', 'id-document', 'rent-statements') THEN 'amber'
    WHEN slug IN ('board-minutes', 'share-certificates', 'company-formation', 'shareholder-agreement') THEN 'slate'
    ELSE COALESCE(color, 'gray')
  END
WHERE description IS NULL OR color IS NULL;

-- Add missing categories
INSERT INTO public.document_categories (org_id, name, slug, description, icon, color, entity_type, is_system, display_order)
VALUES
  (NULL, 'Contracts', 'contracts', 'Purchase contracts, sale agreements, option agreements', 'FileSignature', 'purple', 'property', true, 2),
  (NULL, 'Correspondence', 'correspondence', 'Letters, emails, notices from councils, lenders, agents', 'Mail', 'gray', 'all', true, 23),
  (NULL, 'Licences & Permits', 'licences-permits', 'Planning permissions, building control, other licences', 'Shield', 'purple', 'property', true, 24)
ON CONFLICT (slug) DO NOTHING;

-- Create document_summaries table for AI extraction
CREATE TABLE IF NOT EXISTS public.document_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  summary_type TEXT NOT NULL DEFAULT 'valuation',
  status TEXT NOT NULL DEFAULT 'pending',

  -- Valuation fields
  valuation_figure_gbp NUMERIC,
  valuation_date DATE,
  surveyor_name TEXT,
  surveyor_firm TEXT,
  surveyor_rics_number TEXT,
  valuation_basis TEXT,
  tenure TEXT,
  property_type_noted TEXT,
  condition_rating TEXT,
  condition_notes TEXT,
  key_observations TEXT[],
  special_assumptions TEXT[],
  comparable_evidence JSONB,
  risk_factors TEXT[],
  recommended_actions TEXT[],
  gross_internal_area_sqft NUMERIC,
  price_per_sqft NUMERIC,

  -- General
  executive_summary TEXT,
  ai_model TEXT,
  ai_confidence NUMERIC,
  raw_extraction JSONB,

  property_id UUID REFERENCES public.properties(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_summaries_document ON public.document_summaries(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_summaries_property ON public.document_summaries(property_id);
CREATE INDEX IF NOT EXISTS idx_doc_summaries_org ON public.document_summaries(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_summaries_unique ON public.document_summaries(document_id, summary_type);

ALTER TABLE public.document_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read summaries"
  ON public.document_summaries FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Org members can insert summaries"
  ON public.document_summaries FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Org members can update summaries"
  ON public.document_summaries FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_document_summaries_updated_at
  BEFORE UPDATE ON public.document_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
