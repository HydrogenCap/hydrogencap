
-- Phase 2.6A: Investor Portal — Tables, RLS, Triggers, Views, Storage

-- 1. TABLES
CREATE TABLE public.investors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  investor_name text NOT NULL,
  investor_type text NOT NULL CHECK (investor_type IN ('individual','company','trust','family_office','fund','jv_partner')),
  email text, phone text, company_name text, contact_person text, address text,
  tax_residency text DEFAULT 'UK', preferred_currency text DEFAULT 'GBP',
  accredited_investor boolean DEFAULT false, kyc_completed boolean DEFAULT false, kyc_completed_date date,
  risk_profile text CHECK (risk_profile IS NULL OR risk_profile IN ('conservative','moderate','aggressive')),
  communication_preference text DEFAULT 'email' CHECK (communication_preference IN ('email','portal_only','email_and_portal')),
  portal_access_enabled boolean DEFAULT false, portal_user_id uuid, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_investors_org ON public.investors(org_id);
CREATE TRIGGER update_investors_updated_at BEFORE UPDATE ON public.investors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.investor_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES public.investors(id) ON DELETE RESTRICT,
  entity_id uuid NOT NULL REFERENCES public.legal_entities(id) ON DELETE RESTRICT,
  commitment_type text NOT NULL CHECK (commitment_type IN ('equity','loan','convertible_loan','preference_shares','mezzanine')),
  committed_amount numeric(12,2) NOT NULL, drawn_amount numeric(12,2) DEFAULT 0,
  equity_percentage numeric(5,2), commitment_date date NOT NULL, maturity_date date,
  coupon_rate numeric(5,3),
  payment_frequency text CHECK (payment_frequency IS NULL OR payment_frequency IN ('monthly','quarterly','semi_annual','annual','on_maturity')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','fully_drawn','partially_returned','fully_returned','defaulted')),
  documentation_url text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ic_org ON public.investor_commitments(org_id);
CREATE INDEX idx_ic_investor ON public.investor_commitments(investor_id);
CREATE INDEX idx_ic_entity ON public.investor_commitments(entity_id);
CREATE TRIGGER update_ic_updated_at BEFORE UPDATE ON public.investor_commitments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.investor_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES public.investors(id) ON DELETE RESTRICT,
  commitment_id uuid NOT NULL REFERENCES public.investor_commitments(id) ON DELETE RESTRICT,
  entity_id uuid NOT NULL REFERENCES public.legal_entities(id) ON DELETE RESTRICT,
  distribution_type text NOT NULL CHECK (distribution_type IN ('dividend','interest','loan_repayment','profit_share','capital_return','other')),
  amount numeric(10,2) NOT NULL, distribution_date date NOT NULL,
  period_from date, period_to date, tax_deducted numeric(10,2) DEFAULT 0, net_amount numeric(10,2),
  payment_reference text,
  payment_method text CHECK (payment_method IS NULL OR payment_method IN ('bank_transfer','cheque','reinvested','offset')),
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('declared','approved','paid','cancelled')),
  notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_id_org ON public.investor_distributions(org_id);
CREATE INDEX idx_id_investor ON public.investor_distributions(investor_id);
CREATE INDEX idx_id_commitment ON public.investor_distributions(commitment_id);
CREATE INDEX idx_id_date ON public.investor_distributions(distribution_date);
CREATE TRIGGER update_id_updated_at BEFORE UPDATE ON public.investor_distributions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.calculate_distribution_net_amount()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN NEW.net_amount := NEW.amount - COALESCE(NEW.tax_deducted, 0); RETURN NEW; END; $$;
CREATE TRIGGER calc_dist_net BEFORE INSERT OR UPDATE ON public.investor_distributions FOR EACH ROW EXECUTE FUNCTION public.calculate_distribution_net_amount();

CREATE TABLE public.investor_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  investor_id uuid REFERENCES public.investors(id), entity_id uuid REFERENCES public.legal_entities(id),
  report_type text NOT NULL CHECK (report_type IN ('quarterly','annual','ad_hoc','tax_summary','capital_account')),
  report_period_from date NOT NULL, report_period_to date NOT NULL, title text NOT NULL,
  file_url text, file_name text, generated_at timestamptz DEFAULT now(), generated_by uuid,
  sent_to_investor boolean DEFAULT false, sent_at timestamptz, notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ir_org ON public.investor_reports(org_id);
CREATE INDEX idx_ir_investor ON public.investor_reports(investor_id);

-- 2. RLS
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select" ON public.investors FOR SELECT USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY "org_insert" ON public.investors FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY "org_update" ON public.investors FOR UPDATE USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY "org_delete" ON public.investors FOR DELETE USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "org_select" ON public.investor_commitments FOR SELECT USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY "org_insert" ON public.investor_commitments FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY "org_update" ON public.investor_commitments FOR UPDATE USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY "org_delete" ON public.investor_commitments FOR DELETE USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "org_select" ON public.investor_distributions FOR SELECT USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY "org_insert" ON public.investor_distributions FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY "org_update" ON public.investor_distributions FOR UPDATE USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY "org_delete" ON public.investor_distributions FOR DELETE USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "org_select" ON public.investor_reports FOR SELECT USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY "org_insert" ON public.investor_reports FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY "org_update" ON public.investor_reports FOR UPDATE USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY "org_delete" ON public.investor_reports FOR DELETE USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

-- 3. AUDIT
CREATE TRIGGER audit_investors AFTER INSERT OR UPDATE OR DELETE ON public.investors FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();
CREATE TRIGGER audit_ic AFTER INSERT OR UPDATE OR DELETE ON public.investor_commitments FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();
CREATE TRIGGER audit_id AFTER INSERT OR UPDATE OR DELETE ON public.investor_distributions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- 4. VIEWS
CREATE OR REPLACE VIEW public.investor_portfolio_summary AS
SELECT i.id AS investor_id, i.org_id, i.investor_name, i.investor_type, i.email, i.portal_access_enabled,
  COUNT(DISTINCT ic.entity_id) AS entities_invested, COUNT(DISTINCT ic.id) AS total_commitments,
  COALESCE(SUM(ic.committed_amount),0) AS total_committed, COALESCE(SUM(ic.drawn_amount),0) AS total_drawn,
  COALESCE(SUM(ic.committed_amount)-SUM(ic.drawn_amount),0) AS total_undrawn,
  COALESCE(dist.total_distributed,0) AS total_distributed, COALESCE(dist.total_dividends,0) AS total_dividends,
  COALESCE(dist.total_interest,0) AS total_interest, COALESCE(dist.total_capital_returned,0) AS total_capital_returned,
  CASE WHEN SUM(ic.drawn_amount)>0 THEN ROUND((COALESCE(dist.total_distributed,0)/SUM(ic.drawn_amount))::numeric,2) ELSE 0 END AS distribution_multiple
FROM public.investors i
LEFT JOIN public.investor_commitments ic ON ic.investor_id=i.id AND ic.status IN ('active','fully_drawn')
LEFT JOIN LATERAL (
  SELECT id2.investor_id, SUM(id2.amount) AS total_distributed,
    SUM(id2.amount) FILTER (WHERE id2.distribution_type='dividend') AS total_dividends,
    SUM(id2.amount) FILTER (WHERE id2.distribution_type='interest') AS total_interest,
    SUM(id2.amount) FILTER (WHERE id2.distribution_type IN ('capital_return','loan_repayment')) AS total_capital_returned
  FROM public.investor_distributions id2 WHERE id2.investor_id=i.id AND id2.status='paid' GROUP BY id2.investor_id
) dist ON true
GROUP BY i.id,i.org_id,i.investor_name,i.investor_type,i.email,i.portal_access_enabled,dist.total_distributed,dist.total_dividends,dist.total_interest,dist.total_capital_returned;

CREATE OR REPLACE VIEW public.investor_commitment_detail AS
SELECT ic.id AS commitment_id, ic.org_id, ic.investor_id, i.investor_name,
  ic.entity_id, le.entity_name, le.entity_type, ic.commitment_type,
  ic.committed_amount, ic.drawn_amount, ic.committed_amount-ic.drawn_amount AS undrawn_amount,
  ic.equity_percentage, ic.commitment_date, ic.maturity_date, ic.coupon_rate, ic.payment_frequency,
  ic.status, ic.documentation_url, ic.notes,
  (SELECT COUNT(DISTINCT ol.subject_id) FROM public.companies c JOIN public.ownership_links ol ON ol.owner_party_id=c.party_id AND ol.subject_type='property' AND ol.effective_to IS NULL WHERE c.legal_name=le.entity_name AND c.org_id=le.org_id) AS property_count,
  (SELECT COALESCE(SUM(p.current_value_gbp),0) FROM public.properties p JOIN public.ownership_links ol ON ol.subject_id=p.id AND ol.subject_type='property' AND ol.effective_to IS NULL JOIN public.companies c ON c.party_id=ol.owner_party_id WHERE c.legal_name=le.entity_name AND c.org_id=le.org_id) AS entity_total_valuation,
  CASE WHEN COALESCE(ic.equity_percentage,0)>0 THEN ROUND((SELECT COALESCE(SUM(p.current_value_gbp),0) FROM public.properties p JOIN public.ownership_links ol ON ol.subject_id=p.id AND ol.subject_type='property' AND ol.effective_to IS NULL JOIN public.companies c ON c.party_id=ol.owner_party_id WHERE c.legal_name=le.entity_name AND c.org_id=le.org_id)*ic.equity_percentage/100,2) ELSE 0 END AS investors_share_valuation,
  COALESCE((SELECT SUM(id2.amount) FROM public.investor_distributions id2 WHERE id2.commitment_id=ic.id AND id2.status='paid'),0) AS total_distributions_received
FROM public.investor_commitments ic JOIN public.investors i ON i.id=ic.investor_id JOIN public.legal_entities le ON le.id=ic.entity_id
ORDER BY i.investor_name, le.entity_name;

CREATE OR REPLACE VIEW public.investor_return_metrics AS
SELECT ic.id AS commitment_id, ic.org_id, ic.investor_id, i.investor_name, ic.entity_id, le.entity_name,
  ic.drawn_amount AS capital_invested, COALESCE(dt.total,0) AS total_distributions,
  CASE WHEN ic.drawn_amount>0 AND ad.annual_total IS NOT NULL THEN ROUND((ad.annual_total/ic.drawn_amount*100)::numeric,2) ELSE 0 END AS cash_on_cash_pct,
  CASE WHEN ic.drawn_amount>0 THEN ROUND(((COALESCE(dt.total,0)+COALESCE(ev.share_value,0))/ic.drawn_amount)::numeric,2) ELSE 0 END AS equity_multiple,
  COALESCE(ev.share_value,0) AS current_equity_value,
  COALESCE(ev.share_value,0)-ic.drawn_amount+COALESCE(dt.total,0) AS unrealised_gain_loss
FROM public.investor_commitments ic
JOIN public.investors i ON i.id=ic.investor_id
JOIN public.legal_entities le ON le.id=ic.entity_id
LEFT JOIN LATERAL (SELECT SUM(amount) AS total FROM public.investor_distributions WHERE commitment_id=ic.id AND status='paid') dt ON true
LEFT JOIN LATERAL (SELECT SUM(amount) AS annual_total FROM public.investor_distributions WHERE commitment_id=ic.id AND status='paid' AND distribution_date>=current_date-interval '12 months') ad ON true
LEFT JOIN LATERAL (
  SELECT ROUND(COALESCE(SUM(p.current_value_gbp),0)*COALESCE(ic.equity_percentage,0)/100
    -COALESCE((SELECT SUM(lf.current_balance) FROM public.loan_facilities lf WHERE lf.entity_id=ic.entity_id AND lf.status='active'),0)*COALESCE(ic.equity_percentage,0)/100,2) AS share_value
  FROM public.properties p JOIN public.ownership_links ol ON ol.subject_id=p.id AND ol.subject_type='property' AND ol.effective_to IS NULL
  JOIN public.companies c ON c.party_id=ol.owner_party_id WHERE c.legal_name=le.entity_name AND c.org_id=le.org_id
) ev ON true
WHERE ic.status IN ('active','fully_drawn');

-- 5. STORAGE
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('investor-reports','investor-reports',false,10485760,ARRAY['application/pdf','text/html']);
CREATE POLICY "ir_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id='investor-reports' AND auth.uid() IS NOT NULL);
CREATE POLICY "ir_view" ON storage.objects FOR SELECT USING (bucket_id='investor-reports' AND auth.uid() IS NOT NULL);
CREATE POLICY "ir_delete" ON storage.objects FOR DELETE USING (bucket_id='investor-reports' AND auth.uid() IS NOT NULL);
