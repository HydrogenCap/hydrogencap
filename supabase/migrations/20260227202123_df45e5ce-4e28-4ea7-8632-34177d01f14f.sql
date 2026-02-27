
ALTER TABLE legal_entities
  ADD COLUMN IF NOT EXISTS accounts_due_date DATE,
  ADD COLUMN IF NOT EXISTS accounts_period_end DATE,
  ADD COLUMN IF NOT EXISTS accounts_last_filed_date DATE,
  ADD COLUMN IF NOT EXISTS confirmation_statement_due_date DATE,
  ADD COLUMN IF NOT EXISTS confirmation_statement_last_made_up_to DATE,
  ADD COLUMN IF NOT EXISTS confirmation_statement_last_filed_date DATE,
  ADD COLUMN IF NOT EXISTS ch_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ch_company_status TEXT,
  ADD COLUMN IF NOT EXISTS ch_company_type TEXT;

COMMENT ON COLUMN legal_entities.accounts_due_date IS 'Next annual accounts due date from Companies House';
COMMENT ON COLUMN legal_entities.confirmation_statement_due_date IS 'Next confirmation statement due date from Companies House';
COMMENT ON COLUMN legal_entities.ch_last_synced_at IS 'Timestamp of last Companies House sync';
COMMENT ON COLUMN legal_entities.ch_company_status IS 'Company status from CH (active, dissolved, etc.)';
COMMENT ON COLUMN legal_entities.ch_company_type IS 'Company type from CH (ltd, llp, etc.)';
