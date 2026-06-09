CREATE TABLE IF NOT EXISTS public.arrears_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid,
  property_id uuid NOT NULL,
  room_id uuid,
  risk_score numeric(3,2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 1),
  risk_level text NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  contributing_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  prediction_period text NOT NULL DEFAULT 'next_30_days',
  model_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS arrears_predictions_org_idx ON public.arrears_predictions(org_id);
CREATE INDEX IF NOT EXISTS arrears_predictions_tenant_idx ON public.arrears_predictions(tenant_id);
CREATE INDEX IF NOT EXISTS arrears_predictions_property_idx ON public.arrears_predictions(property_id);
CREATE INDEX IF NOT EXISTS arrears_predictions_risk_idx ON public.arrears_predictions(org_id, risk_score DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.arrears_predictions TO authenticated;
GRANT ALL ON public.arrears_predictions TO service_role;

ALTER TABLE public.arrears_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view arrears predictions"
  ON public.arrears_predictions FOR SELECT TO authenticated
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Org members can insert arrears predictions"
  ON public.arrears_predictions FOR INSERT TO authenticated
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Org members can update arrears predictions"
  ON public.arrears_predictions FOR UPDATE TO authenticated
  USING (public.user_has_org_access(org_id))
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Org members can delete arrears predictions"
  ON public.arrears_predictions FOR DELETE TO authenticated
  USING (public.user_has_org_access(org_id));