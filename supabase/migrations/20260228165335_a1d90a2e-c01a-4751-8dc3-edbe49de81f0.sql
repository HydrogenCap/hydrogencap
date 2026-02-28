
-- AC2b: maintenance_quotes table
CREATE TABLE public.maintenance_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  maintenance_request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  contractor_id UUID REFERENCES public.compliance_contractors_v2(id),
  contractor_name TEXT,
  amount NUMERIC NOT NULL,
  description TEXT,
  estimated_days INTEGER,
  valid_until DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  quote_document_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_maintenance_quotes_request ON public.maintenance_quotes(maintenance_request_id);
CREATE INDEX idx_maintenance_quotes_org ON public.maintenance_quotes(org_id);

ALTER TABLE public.maintenance_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage quotes"
  ON public.maintenance_quotes
  FOR ALL
  USING (org_id IN (SELECT m.org_id FROM public.memberships m WHERE m.user_id = auth.uid()));
