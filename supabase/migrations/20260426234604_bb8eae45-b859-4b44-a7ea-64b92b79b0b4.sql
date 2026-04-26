
CREATE TABLE IF NOT EXISTS public.document_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  extraction_version INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'pending',
  doc_type TEXT,
  doc_type_confidence NUMERIC,
  extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  field_confidences JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_ai_response JSONB,
  pages_processed INTEGER NOT NULL DEFAULT 0,
  total_pages INTEGER NOT NULL DEFAULT 0,
  processing_time_ms INTEGER,
  model_used TEXT,
  needs_human_review BOOLEAN NOT NULL DEFAULT false,
  review_reasons TEXT[] NOT NULL DEFAULT '{}',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_extractions_document_id ON public.document_extractions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_extractions_org_id ON public.document_extractions(org_id);
CREATE INDEX IF NOT EXISTS idx_document_extractions_review ON public.document_extractions(org_id, needs_human_review, status);

ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view extractions"
  ON public.document_extractions FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Org members can insert extractions"
  ON public.document_extractions FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Org members can update extractions"
  ON public.document_extractions FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Org members can delete extractions"
  ON public.document_extractions FOR DELETE TO authenticated
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE TRIGGER update_document_extractions_updated_at
  BEFORE UPDATE ON public.document_extractions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
