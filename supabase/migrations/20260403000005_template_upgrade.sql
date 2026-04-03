-- Template version control
CREATE TABLE public.template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  template_id TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  change_summary TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, template_id, version_number)
);

ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org template versions"
  ON public.template_versions FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can create template versions for own org"
  ON public.template_versions FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own org template versions"
  ON public.template_versions FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own org template versions"
  ON public.template_versions FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE INDEX idx_template_versions_org ON public.template_versions(org_id);
CREATE INDEX idx_template_versions_template ON public.template_versions(template_id);
CREATE INDEX idx_template_versions_lookup ON public.template_versions(org_id, template_id, version_number DESC);

-- Upgrade generated_documents with new columns for document generation workflow
ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS merge_data JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'final', 'sent_for_signing', 'signed')),
  ADD COLUMN IF NOT EXISTS document_url TEXT,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.legal_entities(id);

CREATE INDEX idx_generated_documents_status ON public.generated_documents(status);
CREATE INDEX idx_generated_documents_entity ON public.generated_documents(entity_id);

-- Update policy to allow updates on generated_documents
CREATE POLICY "Users can update own org generated documents"
  ON public.generated_documents FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));
