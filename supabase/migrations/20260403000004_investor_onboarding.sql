-- KYC/AML tracking
CREATE TABLE investor_kyc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id uuid NOT NULL,
  org_id uuid NOT NULL,
  -- Identity verification
  id_document_type text CHECK (id_document_type IN ('passport', 'driving_licence', 'national_id')),
  id_document_url text,
  id_verified boolean DEFAULT false,
  id_verified_at date,
  -- Address verification
  proof_of_address_type text CHECK (proof_of_address_type IN ('utility_bill', 'bank_statement', 'council_tax', 'mortgage_statement')),
  proof_of_address_url text,
  address_verified boolean DEFAULT false,
  -- Source of funds
  source_of_funds text,
  source_of_funds_verified boolean DEFAULT false,
  source_of_funds_doc_url text,
  -- PEP/sanctions
  pep_check_completed boolean DEFAULT false,
  sanctions_check_completed boolean DEFAULT false,
  pep_sanctions_clear boolean,
  -- Overall
  kyc_status text DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'in_progress', 'approved', 'failed', 'expired')),
  approved_by uuid,
  approved_at timestamptz,
  expires_at date, -- KYC typically valid for 12 months
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Capital calls
CREATE TABLE capital_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  total_amount numeric NOT NULL,
  due_date date NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'partially_funded', 'fully_funded', 'overdue', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE capital_call_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capital_call_id uuid NOT NULL REFERENCES capital_calls(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL,
  amount numeric NOT NULL,
  paid_amount numeric DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue', 'waived')),
  paid_at timestamptz,
  payment_reference text
);

-- Investor portal access
ALTER TABLE investors ADD COLUMN IF NOT EXISTS portal_email text;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS portal_enabled boolean DEFAULT false;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS communication_preference text DEFAULT 'email' CHECK (communication_preference IN ('email', 'portal', 'both'));
ALTER TABLE investors ADD COLUMN IF NOT EXISTS reporting_frequency text DEFAULT 'quarterly' CHECK (reporting_frequency IN ('monthly', 'quarterly', 'annual'));

ALTER TABLE investor_kyc ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_call_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org kyc" ON investor_kyc FOR ALL USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));
CREATE POLICY "Org calls" ON capital_calls FOR ALL USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));
CREATE POLICY "Org call items" ON capital_call_items FOR ALL USING (capital_call_id IN (SELECT id FROM capital_calls WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())));
