
-- Track generated template documents
CREATE TABLE public.generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  template_id TEXT NOT NULL,
  property_id UUID REFERENCES public.properties_v2(id),
  tenancy_id UUID REFERENCES public.tenancy_agreements(id),
  tenant_id UUID REFERENCES public.tenants_v2(id),
  generated_data JSONB,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org generated documents"
  ON public.generated_documents FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can create generated documents for own org"
  ON public.generated_documents FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own org generated documents"
  ON public.generated_documents FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE INDEX idx_generated_documents_org ON public.generated_documents(org_id);
CREATE INDEX idx_generated_documents_template ON public.generated_documents(template_id);
