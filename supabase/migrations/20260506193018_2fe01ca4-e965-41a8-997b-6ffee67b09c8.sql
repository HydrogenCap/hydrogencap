-- @allow-v1-refs: pre-cutover historical migration referencing §0a V1 tables (loans/tenancies/costs/income); baked-in DB history, not new code.

DO $$
DECLARE
  v_v1_count int;
  v_v2_count int;
BEGIN
  SELECT count(*) INTO v_v1_count FROM public.costs;

  INSERT INTO public.property_cost_budgets_v2 (
    org_id, property_id, tax_year,
    management_rule_enabled, management_rule_percent_of_rent,
    management_gbp_manual, management_gbp_calculated,
    repairs_rule_enabled, repairs_rule_percent_of_rent,
    repairs_gbp_manual, repairs_gbp_calculated,
    insurance_rule_enabled, insurance_rule_percent_of_value,
    insurance_gbp_manual, insurance_gbp_calculated,
    bills_gbp_manual, compliance_gbp_manual, other_gbp_manual,
    created_at, updated_at
  )
  SELECT
    p2.org_id,
    p2.id,
    format('%s/%s', c.year, lpad(((c.year + 1) % 100)::text, 2, '0')),
    c.management_rule_enabled, c.management_rule_percent_of_rent,
    c.management_gbp_manual, c.management_gbp_calculated,
    c.repairs_rule_enabled, c.repairs_rule_percent_of_rent,
    c.repairs_gbp_manual, c.repairs_gbp_calculated,
    c.insurance_rule_enabled, c.insurance_rule_percent_of_value,
    c.insurance_gbp_manual, c.insurance_gbp_calculated,
    c.bills_gbp_manual, c.compliance_gbp_manual, c.other_gbp_manual,
    c.created_at, c.updated_at
  FROM public.costs c
  JOIN public.properties p ON p.id = c.property_id
  JOIN public.properties_v2 p2
    ON lower(trim(p2.address_line_1)) = lower(trim(p.address_line))
  ON CONFLICT (property_id, tax_year) DO NOTHING;

  SELECT count(*) INTO v_v2_count FROM public.property_cost_budgets_v2;
  IF v_v2_count <> v_v1_count THEN
    RAISE EXCEPTION 'Costs D backfill mismatch: V1=% V2=%', v_v1_count, v_v2_count;
  END IF;
END $$;
