-- Add compliance date fields to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS accounts_due_date date,
ADD COLUMN IF NOT EXISTS accounts_period_end date,
ADD COLUMN IF NOT EXISTS accounts_last_filed_date date,
ADD COLUMN IF NOT EXISTS confirmation_statement_due_date date,
ADD COLUMN IF NOT EXISTS confirmation_statement_last_made_up_to date,
ADD COLUMN IF NOT EXISTS confirmation_statement_last_filed_date date;

-- Create index on company_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_company_number ON public.companies(company_number);

-- Create indexes on due dates for filtering/sorting
CREATE INDEX IF NOT EXISTS idx_companies_accounts_due_date ON public.companies(accounts_due_date);
CREATE INDEX IF NOT EXISTS idx_companies_confirmation_statement_due_date ON public.companies(confirmation_statement_due_date);