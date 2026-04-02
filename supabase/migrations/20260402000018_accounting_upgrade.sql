-- Accounting upgrade: financial transactions + bank statement entries
-- for transaction ledger, bank reconciliation, and P&L

CREATE TABLE financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  property_id uuid,
  entity_id uuid,
  date date NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'rental_income', 'service_charge_income', 'other_income',
    'mortgage_interest', 'mortgage_capital', 'insurance', 'repairs_maintenance',
    'management_fees', 'legal_professional', 'utilities', 'council_tax',
    'ground_rent', 'service_charge_expense', 'advertising', 'travel',
    'office_costs', 'capital_expenditure', 'other_expense',
    'deposit_in', 'deposit_out', 'transfer'
  )),
  amount numeric NOT NULL, -- positive = income, negative = expense
  vat_amount numeric DEFAULT 0,
  payment_method text,
  reference text,
  receipt_url text,
  bank_statement_ref text, -- for reconciliation matching
  reconciled boolean DEFAULT false,
  reconciled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bank_statement_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  bank_account_name text NOT NULL,
  date date NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  balance numeric,
  matched_transaction_id uuid REFERENCES financial_transactions(id),
  status text DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched', 'ignored')),
  imported_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_financial_transactions_org ON financial_transactions(org_id);
CREATE INDEX idx_financial_transactions_date ON financial_transactions(org_id, date);
CREATE INDEX idx_financial_transactions_category ON financial_transactions(org_id, category);
CREATE INDEX idx_financial_transactions_property ON financial_transactions(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX idx_financial_transactions_reconciled ON financial_transactions(org_id, reconciled);
CREATE INDEX idx_bank_statement_entries_org ON bank_statement_entries(org_id);
CREATE INDEX idx_bank_statement_entries_status ON bank_statement_entries(org_id, status);

-- RLS
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statement_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage transactions"
  ON financial_transactions FOR ALL
  USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));

CREATE POLICY "Org members manage statements"
  ON bank_statement_entries FOR ALL
  USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));
