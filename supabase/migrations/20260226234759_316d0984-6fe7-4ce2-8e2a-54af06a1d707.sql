
-- Financial Snapshots: monthly per-property financial time-series
-- Uses trigger-based calculated fields for broader compatibility

CREATE TABLE public.financial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties_v2(id) ON DELETE RESTRICT,
  entity_id uuid NOT NULL REFERENCES public.legal_entities(id) ON DELETE RESTRICT,
  snapshot_month date NOT NULL,
  gross_rent_due numeric(10,2) DEFAULT 0,
  gross_rent_received numeric(10,2) DEFAULT 0,
  void_loss numeric(10,2) DEFAULT 0,
  management_fees numeric(10,2) DEFAULT 0,
  maintenance_costs numeric(10,2) DEFAULT 0,
  insurance_costs numeric(10,2) DEFAULT 0,
  mortgage_payments numeric(10,2) DEFAULT 0,
  utilities numeric(10,2) DEFAULT 0,
  council_tax numeric(10,2) DEFAULT 0,
  licensing_costs numeric(10,2) DEFAULT 0,
  professional_fees numeric(10,2) DEFAULT 0,
  other_costs numeric(10,2) DEFAULT 0,
  other_income numeric(10,2) DEFAULT 0,
  total_costs numeric(10,2) DEFAULT 0,
  net_operating_income numeric(10,2) DEFAULT 0,
  net_cash_flow numeric(10,2) DEFAULT 0,
  occupancy_rate numeric(5,2),
  rent_collection_rate numeric(5,2) DEFAULT 0,
  notes text,
  is_locked boolean DEFAULT false,
  locked_at timestamptz,
  locked_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(property_id, snapshot_month)
);

CREATE INDEX idx_financial_snapshots_org_id ON public.financial_snapshots(org_id);
CREATE INDEX idx_financial_snapshots_property_id ON public.financial_snapshots(property_id);
CREATE INDEX idx_financial_snapshots_entity_id ON public.financial_snapshots(entity_id);
CREATE INDEX idx_financial_snapshots_snapshot_month ON public.financial_snapshots(snapshot_month);
CREATE INDEX idx_financial_snapshots_property_month ON public.financial_snapshots(property_id, snapshot_month);

-- Trigger to auto-calculate derived fields
CREATE OR REPLACE FUNCTION public.calculate_financial_fields()
RETURNS trigger AS $$
BEGIN
  NEW.total_costs := COALESCE(NEW.management_fees, 0) + COALESCE(NEW.maintenance_costs, 0) + 
    COALESCE(NEW.insurance_costs, 0) + COALESCE(NEW.utilities, 0) + COALESCE(NEW.council_tax, 0) + 
    COALESCE(NEW.licensing_costs, 0) + COALESCE(NEW.professional_fees, 0) + COALESCE(NEW.other_costs, 0);

  NEW.net_operating_income := COALESCE(NEW.gross_rent_received, 0) + COALESCE(NEW.other_income, 0) - NEW.total_costs;

  NEW.net_cash_flow := NEW.net_operating_income - COALESCE(NEW.mortgage_payments, 0);

  NEW.rent_collection_rate := CASE
    WHEN COALESCE(NEW.gross_rent_due, 0) > 0 
    THEN round((COALESCE(NEW.gross_rent_received, 0) / NEW.gross_rent_due * 100)::numeric, 2)
    ELSE 0
  END;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_calculate_financials
BEFORE INSERT OR UPDATE ON public.financial_snapshots
FOR EACH ROW EXECUTE FUNCTION public.calculate_financial_fields();

-- Financial categories reference table
CREATE TABLE public.financial_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL,
  category_type text NOT NULL,
  maps_to_snapshot_field text NOT NULL,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.financial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own org financial_snapshots"
  ON public.financial_snapshots FOR ALL
  USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

CREATE POLICY "Authenticated users can read financial_categories"
  ON public.financial_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Views (security_invoker for RLS pass-through)
CREATE OR REPLACE VIEW public.portfolio_monthly_summary
WITH (security_invoker = true) AS
SELECT
  fs.org_id,
  fs.snapshot_month,
  count(DISTINCT fs.property_id) AS property_count,
  sum(fs.gross_rent_due) AS total_rent_due,
  sum(fs.gross_rent_received) AS total_rent_received,
  sum(fs.void_loss) AS total_void_loss,
  sum(fs.total_costs) AS total_costs,
  sum(fs.mortgage_payments) AS total_mortgage_payments,
  sum(fs.net_operating_income) AS total_noi,
  sum(fs.net_cash_flow) AS total_cash_flow,
  CASE WHEN sum(fs.gross_rent_due) > 0
    THEN round((sum(fs.gross_rent_received) / sum(fs.gross_rent_due) * 100)::numeric, 2)
    ELSE 0 END AS portfolio_collection_rate,
  round(avg(fs.occupancy_rate)::numeric, 2) AS avg_occupancy_rate
FROM public.financial_snapshots fs
GROUP BY fs.org_id, fs.snapshot_month
ORDER BY fs.snapshot_month DESC;

CREATE OR REPLACE VIEW public.entity_financial_summary
WITH (security_invoker = true) AS
SELECT
  fs.org_id,
  fs.entity_id,
  le.entity_name,
  le.entity_type,
  fs.snapshot_month,
  count(DISTINCT fs.property_id) AS property_count,
  sum(fs.gross_rent_received) AS total_rent_received,
  sum(fs.total_costs) AS total_costs,
  sum(fs.mortgage_payments) AS total_mortgage_payments,
  sum(fs.net_operating_income) AS total_noi,
  sum(fs.net_cash_flow) AS total_cash_flow
FROM public.financial_snapshots fs
JOIN public.legal_entities le ON le.id = fs.entity_id
GROUP BY fs.org_id, fs.entity_id, le.entity_name, le.entity_type, fs.snapshot_month
ORDER BY fs.snapshot_month DESC, le.entity_name;

CREATE OR REPLACE VIEW public.property_annual_performance
WITH (security_invoker = true) AS
SELECT
  fs.org_id,
  fs.property_id,
  p.address_line_1 || ', ' || p.postcode AS property_address,
  le.entity_name,
  p.current_valuation,
  p.purchase_price,
  sum(fs.gross_rent_received) AS annual_rent_received,
  sum(fs.total_costs) AS annual_costs,
  sum(fs.mortgage_payments) AS annual_mortgage_payments,
  sum(fs.net_operating_income) AS annual_noi,
  sum(fs.net_cash_flow) AS annual_cash_flow,
  round(avg(fs.occupancy_rate)::numeric, 2) AS avg_occupancy,
  round(avg(fs.rent_collection_rate)::numeric, 2) AS avg_collection_rate,
  CASE WHEN p.current_valuation > 0
    THEN round((sum(fs.net_operating_income) / p.current_valuation * 100)::numeric, 2)
    ELSE NULL END AS net_yield_pct,
  CASE WHEN p.purchase_price > 0
    THEN round((sum(fs.net_cash_flow) / p.purchase_price * 100)::numeric, 2)
    ELSE NULL END AS cash_on_cash_return_pct
FROM public.financial_snapshots fs
JOIN public.properties_v2 p ON p.id = fs.property_id
JOIN public.legal_entities le ON le.id = fs.entity_id
WHERE fs.snapshot_month >= (date_trunc('month', current_date) - interval '11 months')::date
GROUP BY fs.org_id, fs.property_id, p.address_line_1, p.postcode, le.entity_name, p.current_valuation, p.purchase_price
ORDER BY sum(fs.net_operating_income) DESC;
