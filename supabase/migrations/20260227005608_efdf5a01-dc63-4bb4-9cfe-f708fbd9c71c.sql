-- @allow-v1-refs: pre-cutover historical migration referencing §0a V1 tables (loans/tenancies/costs/income); baked-in DB history, not new code.

-- Fix migrate_income_costs_to_snapshots: use correct column ownership_entity_id
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

    -- Fixed: use ownership_entity_id instead of entity_id
    SELECT po.ownership_entity_id INTO v_entity_id FROM public.property_ownership po
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
