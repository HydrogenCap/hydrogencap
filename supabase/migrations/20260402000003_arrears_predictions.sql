-- Arrears predictions table for AI-powered rent risk assessment
CREATE TABLE IF NOT EXISTS arrears_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  tenant_id uuid,
  property_id uuid NOT NULL,
  room_id uuid,
  risk_score numeric(3,2) NOT NULL, -- 0.00 to 1.00
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  contributing_factors jsonb NOT NULL DEFAULT '[]',
  recommended_actions text[] NOT NULL DEFAULT '{}',
  prediction_period text NOT NULL, -- e.g. 'next_30_days'
  model_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_arrears_predictions_org_id ON arrears_predictions(org_id);
CREATE INDEX idx_arrears_predictions_property_id ON arrears_predictions(property_id);
CREATE INDEX idx_arrears_predictions_risk_level ON arrears_predictions(risk_level);
CREATE INDEX idx_arrears_predictions_created_at ON arrears_predictions(created_at DESC);

-- RLS
ALTER TABLE arrears_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view predictions for their org"
  ON arrears_predictions FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert predictions for their org"
  ON arrears_predictions FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete predictions for their org"
  ON arrears_predictions FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM memberships WHERE user_id = auth.uid()
    )
  );
