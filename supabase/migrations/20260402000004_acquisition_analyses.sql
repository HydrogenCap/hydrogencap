-- Acquisition analysis table for AI property purchase advisor
CREATE TABLE IF NOT EXISTS public.acquisition_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Input property details
  address text NOT NULL,
  postcode text,
  asking_price numeric,
  estimated_rental numeric,
  property_type text,
  beds int,
  notes text,
  -- AI analysis results
  overall_score numeric(3,2) CHECK (overall_score >= 0 AND overall_score <= 1),
  recommendation text CHECK (recommendation IN ('strong_buy', 'buy', 'hold', 'avoid')),
  strengths jsonb DEFAULT '[]',
  weaknesses jsonb DEFAULT '[]',
  financial_analysis jsonb DEFAULT '{}',
  portfolio_fit_analysis jsonb DEFAULT '{}',
  area_analysis jsonb DEFAULT '{}',
  risk_factors jsonb DEFAULT '[]',
  ai_summary text,
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.acquisition_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own org acquisition analyses"
  ON public.acquisition_analyses FOR ALL
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

-- Indexes for common queries
CREATE INDEX idx_acquisition_analyses_org_id ON public.acquisition_analyses(org_id);
CREATE INDEX idx_acquisition_analyses_created_at ON public.acquisition_analyses(created_at DESC);
CREATE INDEX idx_acquisition_analyses_recommendation ON public.acquisition_analyses(recommendation);
