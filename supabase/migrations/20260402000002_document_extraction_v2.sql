-- Document Extraction V2: multi-page OCR with confidence scoring
CREATE TABLE public.document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  extraction_version integer NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'needs_review')),
  doc_type text,
  doc_type_confidence numeric(3,2),
  extracted_fields jsonb DEFAULT '{}'::jsonb,
  field_confidences jsonb DEFAULT '{}'::jsonb,
  pages_processed integer DEFAULT 0,
  total_pages integer DEFAULT 0,
  processing_time_ms integer,
  model_used text,
  raw_ai_response jsonb,
  needs_human_review boolean NOT NULL DEFAULT false,
  review_reasons text[] DEFAULT '{}',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_document_extractions_document_id ON public.document_extractions(document_id);
CREATE INDEX idx_document_extractions_org_id ON public.document_extractions(org_id);
CREATE INDEX idx_document_extractions_status ON public.document_extractions(status);
CREATE INDEX idx_document_extractions_needs_review ON public.document_extractions(needs_human_review) WHERE needs_human_review = true;
CREATE INDEX idx_document_extractions_created_at ON public.document_extractions(created_at DESC);

-- Updated_at trigger
CREATE TRIGGER set_document_extractions_updated_at
  BEFORE UPDATE ON public.document_extractions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select" ON public.document_extractions
  FOR SELECT USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "org_insert" ON public.document_extractions
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "org_update" ON public.document_extractions
  FOR UPDATE USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "org_delete" ON public.document_extractions
  FOR DELETE USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));
