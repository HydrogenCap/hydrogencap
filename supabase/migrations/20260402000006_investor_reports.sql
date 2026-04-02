-- AI-generated investor reports with editable sections
CREATE TABLE public.ai_investor_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  title TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('quarterly', 'annual', 'custom')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  generated_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  recipients JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ai_investor_reports_org_id ON public.ai_investor_reports(org_id);
CREATE INDEX idx_ai_investor_reports_status ON public.ai_investor_reports(status);
CREATE INDEX idx_ai_investor_reports_report_type ON public.ai_investor_reports(report_type);
CREATE INDEX idx_ai_investor_reports_period ON public.ai_investor_reports(period_start, period_end);
CREATE INDEX idx_ai_investor_reports_created_at ON public.ai_investor_reports(created_at DESC);

-- Updated_at trigger
CREATE TRIGGER update_ai_investor_reports_updated_at
  BEFORE UPDATE ON public.ai_investor_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.ai_investor_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org ai investor reports"
  ON public.ai_investor_reports FOR SELECT
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can insert own org ai investor reports"
  ON public.ai_investor_reports FOR INSERT
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Users can update own org ai investor reports"
  ON public.ai_investor_reports FOR UPDATE
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can delete own org ai investor reports"
  ON public.ai_investor_reports FOR DELETE
  USING (public.user_has_org_access(org_id));
