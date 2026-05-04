CREATE TABLE IF NOT EXISTS public.property_cost_budgets_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties_v2(id) ON DELETE CASCADE,
  tax_year text NOT NULL,
  management_gbp_manual numeric DEFAULT 0,
  bills_gbp_manual numeric DEFAULT 0,
  insurance_gbp_manual numeric DEFAULT 0,
  repairs_gbp_manual numeric DEFAULT 0,
  compliance_gbp_manual numeric DEFAULT 0,
  other_gbp_manual numeric DEFAULT 0,
  management_rule_enabled boolean DEFAULT true,
  management_rule_percent_of_rent numeric DEFAULT 5.0,
  management_gbp_calculated numeric,
  repairs_rule_enabled boolean DEFAULT true,
  repairs_rule_percent_of_rent numeric DEFAULT 5.0,
  repairs_gbp_calculated numeric,
  insurance_rule_enabled boolean DEFAULT true,
  insurance_rule_percent_of_value numeric DEFAULT 0.3,
  insurance_gbp_calculated numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT property_cost_budgets_v2_property_year_unique UNIQUE (property_id, tax_year)
);

CREATE INDEX IF NOT EXISTS idx_pcb_v2_org_id ON public.property_cost_budgets_v2(org_id);
CREATE INDEX IF NOT EXISTS idx_pcb_v2_property_id ON public.property_cost_budgets_v2(property_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_property_cost_budgets_v2_updated_at ON public.property_cost_budgets_v2;
CREATE TRIGGER update_property_cost_budgets_v2_updated_at
BEFORE UPDATE ON public.property_cost_budgets_v2
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.property_cost_budgets_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_cost_budgets_v2_select"
ON public.property_cost_budgets_v2
FOR SELECT
USING (public.user_has_org_access(org_id));

CREATE POLICY "property_cost_budgets_v2_insert"
ON public.property_cost_budgets_v2
FOR INSERT
WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "property_cost_budgets_v2_update"
ON public.property_cost_budgets_v2
FOR UPDATE
USING (public.user_has_org_access(org_id));

CREATE POLICY "property_cost_budgets_v2_delete"
ON public.property_cost_budgets_v2
FOR DELETE
USING (public.user_has_org_access(org_id));