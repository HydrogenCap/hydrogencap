CREATE TABLE mortgage_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  property_id uuid NOT NULL,
  existing_loan_id uuid, -- loan being refinanced
  status text NOT NULL DEFAULT 'researching' CHECK (status IN ('researching', 'dip_submitted', 'dip_approved', 'full_app', 'valuation_instructed', 'valuation_received', 'offer_issued', 'offer_accepted', 'legal_instructed', 'completed', 'withdrawn')),
  -- Lender/product
  lender_name text,
  product_name text,
  product_rate numeric(5,3), -- e.g. 4.250
  product_type text CHECK (product_type IN ('fixed', 'tracker', 'variable', 'discount')),
  product_term_months int, -- e.g. 24, 60
  erc_end_date date,
  arrangement_fee numeric DEFAULT 0,
  valuation_fee numeric DEFAULT 0,
  legal_fee numeric DEFAULT 0,
  -- Amounts
  loan_amount numeric,
  property_value numeric,
  ltv numeric(5,2),
  -- Broker
  broker_name text,
  broker_company text,
  broker_fee numeric DEFAULT 0,
  -- Timeline
  dip_submitted_at date,
  dip_approved_at date,
  full_app_submitted_at date,
  valuation_date date,
  offer_date date,
  completion_target date,
  completed_at date,
  -- Comparison
  current_rate numeric(5,3),
  current_payment numeric,
  new_payment numeric,
  monthly_saving numeric,
  total_cost_of_switch numeric, -- fees - savings over term
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mortgage_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org mortgage apps" ON mortgage_applications FOR ALL USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));
