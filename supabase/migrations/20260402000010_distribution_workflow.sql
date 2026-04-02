-- Distribution Workflow V2: quarterly distribution runs with line-item tracking
-- Extends the existing distributions system with a more granular workflow

CREATE TABLE distribution_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  period text NOT NULL, -- 'Q1-2026', 'Q2-2026'
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'processing', 'completed', 'cancelled')),
  total_distributable numeric NOT NULL DEFAULT 0,
  total_distributed numeric NOT NULL DEFAULT 0,
  retained_amount numeric NOT NULL DEFAULT 0,
  notes text,
  approved_by uuid,
  approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE distribution_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_run_id uuid NOT NULL REFERENCES distribution_runs(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL,
  entity_id uuid,
  property_ids uuid[],
  ownership_pct numeric(5,2) NOT NULL,
  gross_amount numeric NOT NULL,
  withholding_tax numeric DEFAULT 0,
  net_amount numeric NOT NULL,
  payment_method text,
  payment_reference text,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE distribution_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage runs" ON distribution_runs
  FOR ALL USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));

CREATE POLICY "Org members manage line items" ON distribution_line_items
  FOR ALL USING (distribution_run_id IN (
    SELECT id FROM distribution_runs
    WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
  ));

-- Indexes
CREATE INDEX idx_distribution_runs_org_id ON distribution_runs(org_id);
CREATE INDEX idx_distribution_runs_status ON distribution_runs(status);
CREATE INDEX idx_distribution_runs_period ON distribution_runs(period);
CREATE INDEX idx_distribution_line_items_run_id ON distribution_line_items(distribution_run_id);
CREATE INDEX idx_distribution_line_items_investor_id ON distribution_line_items(investor_id);
CREATE INDEX idx_distribution_line_items_payment_status ON distribution_line_items(payment_status);
