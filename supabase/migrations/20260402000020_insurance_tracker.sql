-- Extend existing insurance_policies table with tracker columns
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS policy_type text CHECK (policy_type IN ('buildings', 'contents', 'landlord_liability', 'rent_guarantee', 'legal_expenses', 'combined', 'other'));
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS insurer_name text;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS policy_number text;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS premium_annual numeric;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS premium_frequency text DEFAULT 'annual' CHECK (premium_frequency IN ('annual', 'monthly'));
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS excess_amount numeric;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS cover_amount numeric;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT false;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS document_url text;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'expiring', 'expired', 'cancelled'));

-- Insurance claims
CREATE TABLE IF NOT EXISTS insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES insurance_policies(id),
  org_id uuid NOT NULL,
  property_id uuid,
  claim_reference text,
  claim_date date NOT NULL,
  description text NOT NULL,
  amount_claimed numeric,
  amount_settled numeric,
  status text DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'settled', 'rejected', 'withdrawn')),
  settled_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage claims" ON insurance_claims FOR ALL USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_insurance_claims_org_id ON insurance_claims(org_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_policy_id ON insurance_claims(policy_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims(status);
