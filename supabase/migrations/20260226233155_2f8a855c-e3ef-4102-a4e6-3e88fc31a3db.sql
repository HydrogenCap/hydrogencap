
-- Lenders table (org-scoped)
CREATE TABLE public.lenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  lender_name TEXT NOT NULL,
  lender_type TEXT NOT NULL CHECK (lender_type IN ('high_street', 'specialist_btl', 'bridging', 'development', 'private', 'mezzanine')),
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  broker_name TEXT,
  broker_email TEXT,
  broker_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lenders_org_id ON public.lenders(org_id);
CREATE INDEX idx_lenders_lender_type ON public.lenders(lender_type);

-- Loan Facilities table (org-scoped, linked to properties_v2 and legal_entities)
CREATE TABLE public.loan_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  property_id UUID NOT NULL REFERENCES public.properties_v2(id) ON DELETE RESTRICT,
  lender_id UUID NOT NULL REFERENCES public.lenders(id) ON DELETE RESTRICT,
  entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE RESTRICT,
  facility_type TEXT NOT NULL CHECK (facility_type IN ('term_mortgage', 'bridging', 'development_finance', 'mezzanine', 'overdraft', 'directors_loan', 'second_charge')),
  original_amount NUMERIC(12,2) NOT NULL,
  current_balance NUMERIC(12,2) NOT NULL,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('fixed', 'variable', 'tracker', 'discount')),
  interest_rate NUMERIC(5,3) NOT NULL,
  rate_expiry_date DATE,
  revert_rate NUMERIC(5,3),
  monthly_payment NUMERIC(10,2),
  term_start_date DATE NOT NULL,
  term_end_date DATE NOT NULL,
  early_repayment_charge_until DATE,
  erc_percentage NUMERIC(5,2),
  ltv_at_drawdown NUMERIC(5,2),
  current_ltv NUMERIC(5,2),
  interest_only BOOLEAN DEFAULT true,
  repayment_type TEXT NOT NULL DEFAULT 'interest_only' CHECK (repayment_type IN ('interest_only', 'repayment', 'part_and_part', 'rolled_up')),
  arrangement_fee NUMERIC(10,2),
  valuation_fee NUMERIC(8,2),
  legal_fee NUMERIC(8,2),
  total_setup_costs NUMERIC(10,2),
  covenant_ltv_max NUMERIC(5,2),
  covenant_icr_min NUMERIC(5,2),
  product_name TEXT,
  account_reference TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'in_arrears', 'default', 'pending_drawdown', 'expired_product')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_loan_facilities_org_id ON public.loan_facilities(org_id);
CREATE INDEX idx_loan_facilities_property_id ON public.loan_facilities(property_id);
CREATE INDEX idx_loan_facilities_lender_id ON public.loan_facilities(lender_id);
CREATE INDEX idx_loan_facilities_entity_id ON public.loan_facilities(entity_id);
CREATE INDEX idx_loan_facilities_status ON public.loan_facilities(status);
CREATE INDEX idx_loan_facilities_term_end_date ON public.loan_facilities(term_end_date);
CREATE INDEX idx_loan_facilities_rate_expiry_date ON public.loan_facilities(rate_expiry_date);

-- RLS for lenders
ALTER TABLE public.lenders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lenders_select" ON public.lenders FOR SELECT USING (public.user_has_org_access(org_id));
CREATE POLICY "lenders_insert" ON public.lenders FOR INSERT WITH CHECK (public.user_has_org_access(org_id));
CREATE POLICY "lenders_update" ON public.lenders FOR UPDATE USING (public.user_has_org_access(org_id));
CREATE POLICY "lenders_delete" ON public.lenders FOR DELETE USING (public.user_has_org_access(org_id));

-- RLS for loan_facilities
ALTER TABLE public.loan_facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loan_facilities_select" ON public.loan_facilities FOR SELECT USING (public.user_has_org_access(org_id));
CREATE POLICY "loan_facilities_insert" ON public.loan_facilities FOR INSERT WITH CHECK (public.user_has_org_access(org_id));
CREATE POLICY "loan_facilities_update" ON public.loan_facilities FOR UPDATE USING (public.user_has_org_access(org_id));
CREATE POLICY "loan_facilities_delete" ON public.loan_facilities FOR DELETE USING (public.user_has_org_access(org_id));

-- Updated_at triggers
CREATE TRIGGER update_lenders_updated_at
  BEFORE UPDATE ON public.lenders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loan_facilities_updated_at
  BEFORE UPDATE ON public.loan_facilities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-calculate current LTV when property valuation changes
CREATE OR REPLACE FUNCTION public.recalculate_ltv_v2()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.loan_facilities lf
  SET current_ltv = CASE
        WHEN NEW.current_valuation IS NOT NULL AND NEW.current_valuation > 0
        THEN round((lf.current_balance / NEW.current_valuation * 100)::numeric, 2)
        ELSE NULL
      END,
      updated_at = now()
  WHERE lf.property_id = NEW.id
    AND lf.status = 'active';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE TRIGGER trigger_recalculate_ltv_on_valuation_v2
AFTER UPDATE OF current_valuation ON public.properties_v2
FOR EACH ROW EXECUTE FUNCTION public.recalculate_ltv_v2();

-- Portfolio Debt Summary View
CREATE OR REPLACE VIEW public.portfolio_debt_summary AS
SELECT
  l.id AS lender_id,
  l.org_id,
  l.lender_name,
  l.lender_type,
  count(lf.id) AS facility_count,
  COALESCE(sum(lf.current_balance), 0) AS total_exposure,
  COALESCE(sum(lf.monthly_payment), 0) AS total_monthly_payments,
  COALESCE(avg(lf.interest_rate), 0) AS avg_interest_rate,
  count(lf.id) FILTER (WHERE lf.rate_type = 'fixed') AS fixed_count,
  count(lf.id) FILTER (WHERE lf.rate_type IN ('variable', 'tracker', 'discount')) AS variable_count,
  COALESCE(sum(lf.current_balance) FILTER (WHERE lf.rate_type = 'fixed'), 0) AS fixed_balance,
  COALESCE(sum(lf.current_balance) FILTER (WHERE lf.rate_type IN ('variable', 'tracker', 'discount')), 0) AS variable_balance,
  min(lf.term_end_date) FILTER (WHERE lf.status = 'active') AS nearest_term_end,
  min(lf.rate_expiry_date) FILTER (WHERE lf.status = 'active' AND lf.rate_expiry_date > current_date) AS nearest_rate_expiry
FROM public.lenders l
LEFT JOIN public.loan_facilities lf ON lf.lender_id = l.id AND lf.status = 'active'
GROUP BY l.id, l.org_id, l.lender_name, l.lender_type;

-- Loan Alerts View
CREATE OR REPLACE VIEW public.loan_alerts AS
SELECT
  lf.id AS loan_id,
  lf.org_id,
  lf.property_id,
  p.address_line_1 || ', ' || p.postcode AS property_address,
  l.lender_name,
  lf.facility_type,
  lf.current_balance,
  lf.interest_rate,
  lf.rate_type,
  lf.rate_expiry_date,
  lf.revert_rate,
  lf.term_end_date,
  lf.early_repayment_charge_until,
  lf.current_ltv,
  lf.covenant_ltv_max,
  lf.covenant_icr_min,
  CASE
    WHEN lf.rate_expiry_date IS NOT NULL AND lf.rate_expiry_date <= current_date THEN 'rate_expired'
    WHEN lf.rate_expiry_date IS NOT NULL AND lf.rate_expiry_date <= current_date + interval '90 days' THEN 'rate_expiring_soon'
    ELSE NULL
  END AS rate_alert,
  CASE
    WHEN lf.term_end_date <= current_date THEN 'term_expired'
    WHEN lf.term_end_date <= current_date + interval '6 months' THEN 'term_ending_soon'
    WHEN lf.term_end_date <= current_date + interval '12 months' THEN 'term_ending_within_year'
    ELSE NULL
  END AS term_alert,
  CASE
    WHEN lf.early_repayment_charge_until IS NULL THEN 'no_erc'
    WHEN lf.early_repayment_charge_until <= current_date THEN 'erc_expired'
    WHEN lf.early_repayment_charge_until <= current_date + interval '3 months' THEN 'erc_ending_soon'
    ELSE 'erc_active'
  END AS erc_alert,
  CASE
    WHEN lf.covenant_ltv_max IS NOT NULL AND lf.current_ltv IS NOT NULL THEN
      CASE
        WHEN lf.current_ltv >= lf.covenant_ltv_max THEN 'covenant_breach'
        WHEN lf.current_ltv >= lf.covenant_ltv_max * 0.9 THEN 'covenant_warning'
        ELSE 'covenant_ok'
      END
    ELSE NULL
  END AS ltv_covenant_alert,
  CASE WHEN lf.rate_expiry_date IS NOT NULL THEN lf.rate_expiry_date - current_date ELSE NULL END AS days_to_rate_expiry,
  lf.term_end_date - current_date AS days_to_term_end,
  CASE WHEN lf.early_repayment_charge_until IS NOT NULL THEN lf.early_repayment_charge_until - current_date ELSE NULL END AS days_to_erc_end
FROM public.loan_facilities lf
JOIN public.properties_v2 p ON p.id = lf.property_id
JOIN public.lenders l ON l.id = lf.lender_id
WHERE lf.status = 'active';
