-- @allow-v1-refs: pre-cutover historical migration referencing §0a V1 tables (loans/tenancies/costs/income); baked-in DB history, not new code.

-- Fix migrate_loans_to_v2: remove ::text casts for date columns
CREATE OR REPLACE FUNCTION public.migrate_loans_to_v2(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  migrated_count integer := 0;
  skipped_count integer := 0;
  rec record;
  v2_property_id uuid;
  v_lender_id uuid;
  v_entity_id uuid;
  v_term_start date;
  v_term_end date;
BEGIN
  FOR rec IN
    SELECT l.*, p.address_line AS prop_address, p.postcode AS prop_postcode
    FROM public.loans l
    JOIN public.properties p ON p.id = l.property_id
    WHERE EXISTS (
      SELECT 1 FROM public.memberships m
      JOIN public.properties pp ON pp.org_id = m.org_id
      WHERE pp.id = l.property_id AND m.org_id = p_org_id
    )
  LOOP
    SELECT pv.id INTO v2_property_id FROM public.properties_v2 pv
    WHERE pv.address_line_1 = rec.prop_address AND pv.postcode = rec.prop_postcode AND pv.org_id = p_org_id LIMIT 1;

    IF v2_property_id IS NULL THEN skipped_count := skipped_count + 1; CONTINUE; END IF;

    IF EXISTS (SELECT 1 FROM public.loan_facilities lf
      WHERE lf.property_id = v2_property_id
      AND lf.current_balance = COALESCE(rec.current_mortgage_balance_gbp, 0)) THEN
      skipped_count := skipped_count + 1; CONTINUE;
    END IF;

    IF rec.lender IS NOT NULL AND trim(rec.lender) != '' THEN
      SELECT id INTO v_lender_id FROM public.lenders
      WHERE lender_name = trim(rec.lender) AND org_id = p_org_id LIMIT 1;
      IF v_lender_id IS NULL THEN
        INSERT INTO public.lenders (lender_name, lender_type, org_id)
        VALUES (trim(rec.lender), 'bank', p_org_id)
        RETURNING id INTO v_lender_id;
      END IF;
    ELSE
      SELECT id INTO v_lender_id FROM public.lenders
      WHERE lender_name = 'Unknown Lender' AND org_id = p_org_id LIMIT 1;
      IF v_lender_id IS NULL THEN
        INSERT INTO public.lenders (lender_name, lender_type, org_id)
        VALUES ('Unknown Lender', 'bank', p_org_id)
        RETURNING id INTO v_lender_id;
      END IF;
    END IF;

    SELECT po.entity_id INTO v_entity_id FROM public.property_ownership po
    WHERE po.property_id = v2_property_id LIMIT 1;
    IF v_entity_id IS NULL THEN
      SELECT id INTO v_entity_id FROM public.legal_entities WHERE org_id = p_org_id LIMIT 1;
    END IF;
    IF v_entity_id IS NULL THEN
      INSERT INTO public.legal_entities (entity_name, entity_type, org_id, status)
      VALUES ('Unassigned Entity', 'personal', p_org_id, 'active')
      RETURNING id INTO v_entity_id;
    END IF;

    v_term_start := COALESCE(rec.loan_start_date, rec.created_at::date);
    v_term_end := CASE
      WHEN rec.loan_term_months IS NOT NULL THEN v_term_start + (rec.loan_term_months || ' months')::interval
      WHEN rec.term_years IS NOT NULL THEN v_term_start + (rec.term_years || ' years')::interval
      ELSE v_term_start + interval '25 years'
    END;

    INSERT INTO public.loan_facilities (
      property_id, entity_id, lender_id, org_id,
      facility_type, current_balance, original_amount,
      interest_rate, rate_type, repayment_type,
      monthly_payment, rate_expiry_date,
      revert_rate, term_start_date, term_end_date,
      status, notes
    ) VALUES (
      v2_property_id, v_entity_id, v_lender_id, p_org_id,
      COALESCE(rec.mortgage_type, 'mortgage'),
      COALESCE(rec.current_mortgage_balance_gbp, 0),
      COALESCE(rec.current_mortgage_balance_gbp, 0),
      COALESCE(rec.interest_rate_percent, 0),
      CASE
        WHEN rec.fixed_or_variable = 'variable' THEN 'variable'
        WHEN rec.fixed_or_variable = 'tracker' THEN 'tracker'
        ELSE 'fixed'
      END,
      CASE
        WHEN rec.capital_or_interest = 'interest' THEN 'interest_only'
        WHEN rec.capital_or_interest = 'repayment' THEN 'repayment'
        ELSE 'interest_only'
      END,
      rec.mortgage_payment_gbp,
      rec.fixed_rate_expires,
      rec.reversion_rate_percent,
      v_term_start,
      v_term_end::date,
      'active',
      concat_ws(E'\n', rec.notes,
        CASE WHEN rec.broker_name IS NOT NULL THEN 'Broker: ' || rec.broker_name END,
        CASE WHEN rec.broker_contact IS NOT NULL THEN 'Broker contact: ' || rec.broker_contact END,
        'Migrated from V1 loans on ' || now()::date
      )
    );
    migrated_count := migrated_count + 1;
  END LOOP;

  RETURN jsonb_build_object('migrated', migrated_count, 'skipped', skipped_count, 'table', 'loans → loan_facilities');
END;
$function$;

-- Fix migrate_income_costs_to_snapshots: use date type for snapshot_month
CREATE OR REPLACE FUNCTION public.migrate_income_costs_to_snapshots(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  migrated_count integer := 0;
  skipped_count integer := 0;
  rec record;
  v2_property_id uuid;
  v_entity_id uuid;
  v_snapshot_month date;
  v_annual_rent numeric;
  v_insurance numeric;
  v_management numeric;
  v_repairs numeric;
  v_other numeric;
  v_bills numeric;
  v_compliance numeric;
BEGIN
  FOR rec IN
    SELECT DISTINCT p.id AS v1_property_id, p.address_line AS prop_address, p.postcode AS prop_postcode,
      i.year, i.annual_rent_gbp,
      c.insurance_gbp_manual, c.management_gbp_manual, c.repairs_gbp_manual,
      c.other_gbp_manual, c.bills_gbp_manual, c.compliance_gbp_manual,
      c.insurance_gbp_calculated, c.management_gbp_calculated, c.repairs_gbp_calculated
    FROM public.properties p
    LEFT JOIN public.income i ON i.property_id = p.id
    LEFT JOIN public.costs c ON c.property_id = p.id AND c.year = COALESCE(i.year, EXTRACT(YEAR FROM now())::integer)
    WHERE p.org_id = p_org_id
    AND (i.id IS NOT NULL OR c.id IS NOT NULL)
  LOOP
    SELECT pv.id INTO v2_property_id FROM public.properties_v2 pv
    WHERE pv.address_line_1 = rec.prop_address AND pv.postcode = rec.prop_postcode AND pv.org_id = p_org_id LIMIT 1;

    IF v2_property_id IS NULL THEN skipped_count := skipped_count + 1; CONTINUE; END IF;

    v_snapshot_month := make_date(COALESCE(rec.year, EXTRACT(YEAR FROM now())::integer), 1, 1);

    IF EXISTS (SELECT 1 FROM public.financial_snapshots fs
      WHERE fs.property_id = v2_property_id AND fs.snapshot_month = v_snapshot_month) THEN
      skipped_count := skipped_count + 1; CONTINUE;
    END IF;

    SELECT po.entity_id INTO v_entity_id FROM public.property_ownership po
    WHERE po.property_id = v2_property_id LIMIT 1;
    IF v_entity_id IS NULL THEN
      SELECT id INTO v_entity_id FROM public.legal_entities WHERE org_id = p_org_id LIMIT 1;
    END IF;
    IF v_entity_id IS NULL THEN
      INSERT INTO public.legal_entities (entity_name, entity_type, org_id, status)
      VALUES ('Unassigned Entity', 'personal', p_org_id, 'active')
      RETURNING id INTO v_entity_id;
    END IF;

    v_annual_rent := COALESCE(rec.annual_rent_gbp, 0);
    v_insurance := COALESCE(rec.insurance_gbp_manual, rec.insurance_gbp_calculated, 0);
    v_management := COALESCE(rec.management_gbp_manual, rec.management_gbp_calculated, 0);
    v_repairs := COALESCE(rec.repairs_gbp_manual, rec.repairs_gbp_calculated, 0);
    v_other := COALESCE(rec.other_gbp_manual, 0);
    v_bills := COALESCE(rec.bills_gbp_manual, 0);
    v_compliance := COALESCE(rec.compliance_gbp_manual, 0);

    INSERT INTO public.financial_snapshots (
      property_id, entity_id, org_id, snapshot_month,
      gross_rent_due, gross_rent_received,
      insurance_costs, management_fees, maintenance_costs,
      utilities, other_costs,
      notes
    ) VALUES (
      v2_property_id, v_entity_id, p_org_id, v_snapshot_month,
      v_annual_rent, v_annual_rent,
      v_insurance, v_management,
      v_repairs + v_compliance,
      v_bills, v_other,
      'Migrated from V1 income/costs (year ' || COALESCE(rec.year, EXTRACT(YEAR FROM now())::integer) || ') on ' || now()::date
    );
    migrated_count := migrated_count + 1;
  END LOOP;

  RETURN jsonb_build_object('migrated', migrated_count, 'skipped', skipped_count, 'table', 'income/costs → financial_snapshots');
END;
$function$;
