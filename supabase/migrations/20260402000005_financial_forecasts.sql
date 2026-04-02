-- Financial Forecasts: AI-powered cashflow projections and stress testing
CREATE TABLE IF NOT EXISTS public.financial_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    forecast_type TEXT NOT NULL CHECK (forecast_type IN ('cashflow', 'stress_test', 'rate_scenario')),
    name TEXT NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    results JSONB NOT NULL DEFAULT '[]'::jsonb,
    scenarios JSONB DEFAULT NULL,
    ai_commentary TEXT,
    model_used TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_financial_forecasts_org_id ON public.financial_forecasts(org_id);
CREATE INDEX idx_financial_forecasts_type ON public.financial_forecasts(org_id, forecast_type);
CREATE INDEX idx_financial_forecasts_created ON public.financial_forecasts(org_id, created_at DESC);

-- RLS
ALTER TABLE public.financial_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view forecasts in their org"
    ON public.financial_forecasts FOR SELECT
    USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can create forecasts in their org"
    ON public.financial_forecasts FOR INSERT
    WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Users can delete forecasts in their org"
    ON public.financial_forecasts FOR DELETE
    USING (public.user_has_org_access(org_id));
