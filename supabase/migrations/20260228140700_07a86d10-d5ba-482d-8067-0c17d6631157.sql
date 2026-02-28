-- Add missing fields needed for AA4a/AA4b tenancy lifecycle
ALTER TABLE tenancy_agreements ADD COLUMN IF NOT EXISTS break_clause_date DATE;
ALTER TABLE tenancy_agreements ADD COLUMN IF NOT EXISTS last_rent_review_date TIMESTAMPTZ;
ALTER TABLE tenancy_agreements ADD COLUMN IF NOT EXISTS last_rent_review_amount NUMERIC;
