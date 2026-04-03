-- Company Filing Deadlines table
CREATE TABLE public.company_filing_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  filing_type TEXT NOT NULL CHECK (filing_type IN ('confirmation_statement', 'annual_accounts', 'ct600', 'vat_return')),
  due_date DATE NOT NULL,
  filed_date DATE,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'overdue', 'filed')),
  reference TEXT,
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_filing_deadlines_entity_id ON public.company_filing_deadlines(entity_id);
CREATE INDEX idx_company_filing_deadlines_org_id ON public.company_filing_deadlines(org_id);
CREATE INDEX idx_company_filing_deadlines_due_date ON public.company_filing_deadlines(due_date);

CREATE TRIGGER update_company_filing_deadlines_updated_at
  BEFORE UPDATE ON public.company_filing_deadlines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.company_filing_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org filing deadlines"
  ON public.company_filing_deadlines FOR SELECT
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can insert own org filing deadlines"
  ON public.company_filing_deadlines FOR INSERT
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Users can update own org filing deadlines"
  ON public.company_filing_deadlines FOR UPDATE
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can delete own org filing deadlines"
  ON public.company_filing_deadlines FOR DELETE
  USING (public.user_has_org_access(org_id));


-- Director Appointments table (extended register with roles and PSC)
CREATE TABLE public.director_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  person_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('director', 'secretary', 'psc')),
  appointed_date DATE NOT NULL,
  resigned_date DATE,
  companies_house_id TEXT,
  nature_of_control TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_director_appointments_entity_id ON public.director_appointments(entity_id);
CREATE INDEX idx_director_appointments_org_id ON public.director_appointments(org_id);

CREATE TRIGGER update_director_appointments_updated_at
  BEFORE UPDATE ON public.director_appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.director_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org director appointments"
  ON public.director_appointments FOR SELECT
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can insert own org director appointments"
  ON public.director_appointments FOR INSERT
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Users can update own org director appointments"
  ON public.director_appointments FOR UPDATE
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can delete own org director appointments"
  ON public.director_appointments FOR DELETE
  USING (public.user_has_org_access(org_id));


-- Intercompany Loans table
CREATE TABLE public.intercompany_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  lender_entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  borrower_entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  principal NUMERIC NOT NULL,
  interest_rate NUMERIC(5,3) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  maturity_date DATE,
  outstanding_balance NUMERIC NOT NULL,
  interest_accrued NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'repaid', 'written_off')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_intercompany_loans_org_id ON public.intercompany_loans(org_id);
CREATE INDEX idx_intercompany_loans_lender ON public.intercompany_loans(lender_entity_id);
CREATE INDEX idx_intercompany_loans_borrower ON public.intercompany_loans(borrower_entity_id);

CREATE TRIGGER update_intercompany_loans_updated_at
  BEFORE UPDATE ON public.intercompany_loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.intercompany_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org intercompany loans"
  ON public.intercompany_loans FOR SELECT
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can insert own org intercompany loans"
  ON public.intercompany_loans FOR INSERT
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Users can update own org intercompany loans"
  ON public.intercompany_loans FOR UPDATE
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can delete own org intercompany loans"
  ON public.intercompany_loans FOR DELETE
  USING (public.user_has_org_access(org_id));
