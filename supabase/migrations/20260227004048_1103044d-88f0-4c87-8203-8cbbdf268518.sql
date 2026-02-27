
-- Fix property_type mapping in migrate_properties_to_v2
CREATE OR REPLACE FUNCTION public.migrate_properties_to_v2(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  migrated_count integer := 0;
  skipped_count integer := 0;
  unassigned_entity_id uuid;
  rec record;
  matched_entity_id uuid;
  v_lifecycle_stage text;
  v_property_type text;
BEGIN
  SELECT id INTO unassigned_entity_id FROM public.legal_entities
  WHERE entity_name = 'Unassigned (Migration)' AND org_id = p_org_id;

  IF unassigned_entity_id IS NULL THEN
    INSERT INTO public.legal_entities (entity_name, entity_type, status, org_id, notes)
    VALUES ('Unassigned (Migration)', 'personal', 'active', p_org_id, 'Auto-created during V1→V2 migration.')
    RETURNING id INTO unassigned_entity_id;
  END IF;

  FOR rec IN
    SELECT p.* FROM public.properties p
    WHERE p.org_id = p_org_id
    AND NOT EXISTS (
      SELECT 1 FROM public.properties_v2 pv
      WHERE pv.address_line_1 = p.address_line AND pv.postcode = p.postcode AND pv.org_id = p.org_id
    )
  LOOP
    matched_entity_id := NULL;
    IF rec.legal_owner_company_id IS NOT NULL THEN
      SELECT le.id INTO matched_entity_id
      FROM public.companies c
      JOIN public.legal_entities le ON le.company_number = c.company_number AND le.org_id = c.org_id
      WHERE c.id = rec.legal_owner_company_id;
    END IF;

    IF matched_entity_id IS NULL AND rec.ownership_entity IS NOT NULL THEN
      SELECT le.id INTO matched_entity_id
      FROM public.legal_entities le
      WHERE le.entity_name ILIKE '%' || rec.ownership_entity || '%' AND le.org_id = rec.org_id
      LIMIT 1;
    END IF;

    IF matched_entity_id IS NULL THEN
      matched_entity_id := unassigned_entity_id;
    END IF;

    -- Map V1 lifecycle_type to valid V2 lifecycle_stage
    v_lifecycle_stage := CASE rec.lifecycle_type
      WHEN 'core_rental' THEN 'stabilised'
      WHEN 'development' THEN 'refurbishment'
      WHEN 'pipeline' THEN 'pipeline'
      WHEN 'acquisition' THEN 'acquisition'
      WHEN 'refurbishment' THEN 'refurbishment'
      WHEN 'letting' THEN 'letting'
      WHEN 'stabilised' THEN 'stabilised'
      WHEN 'disposal' THEN 'disposal'
      ELSE 'stabilised'
    END;

    -- Map V1 property_type to valid V2 property_type
    -- V2 valid: hmo_licensed, hmo_mandatory, single_let, multi_unit_freehold, commercial, mixed_use
    v_property_type := CASE
      WHEN rec.property_type ILIKE '%hmo%' THEN 'hmo_licensed'
      WHEN rec.property_type ILIKE '%commercial%' THEN 'commercial'
      WHEN rec.property_type ILIKE '%mixed%' THEN 'mixed_use'
      WHEN rec.property_type ILIKE '%multi%' THEN 'multi_unit_freehold'
      WHEN rec.property_type IN ('hmo_licensed', 'hmo_mandatory', 'single_let', 'multi_unit_freehold', 'commercial', 'mixed_use') THEN rec.property_type
      ELSE 'single_let'
    END;

    INSERT INTO public.properties_v2 (
      address_line_1, address_line_2, city, county, country, postcode,
      property_type, lifecycle_stage, listing_grade, entity_id, org_id,
      has_gas_supply, current_valuation, valuation_date, purchase_price,
      purchase_date, latitude, longitude, notes
    ) VALUES (
      rec.address_line, rec.address_line2,
      COALESCE(rec.town_city, rec.area_name, 'Unknown'),
      rec.county, COALESCE(rec.country, 'England'),
      COALESCE(rec.postcode, 'UNKNOWN'),
      v_property_type,
      v_lifecycle_stage,
      COALESCE(rec.listing_grade, CASE WHEN rec.is_grade_listed = true THEN 'grade_ii' ELSE 'none' END, 'none'),
      matched_entity_id, rec.org_id, rec.has_gas,
      COALESCE(rec.current_value_gbp, rec.last_valuation_estimate),
      rec.last_valuation_date, rec.purchase_price_gbp, rec.original_purchase_date,
      rec.latitude, rec.longitude,
      concat_ws(E'\n', rec.notes,
        CASE WHEN rec.title_number IS NOT NULL THEN 'Title: ' || rec.title_number END,
        CASE WHEN rec.uprn IS NOT NULL THEN 'UPRN: ' || rec.uprn END,
        CASE WHEN rec.stamp_duty_gbp IS NOT NULL THEN 'Stamp duty: £' || rec.stamp_duty_gbp END,
        CASE WHEN rec.legal_fees_gbp IS NOT NULL THEN 'Legal fees: £' || rec.legal_fees_gbp END,
        CASE WHEN rec.refurb_cost_gbp IS NOT NULL THEN 'Refurb cost: £' || rec.refurb_cost_gbp END,
        CASE WHEN rec.capital_invested_gbp IS NOT NULL THEN 'Capital invested: £' || rec.capital_invested_gbp END,
        CASE WHEN rec.heritage_notes IS NOT NULL THEN 'Heritage: ' || rec.heritage_notes END,
        'Migrated from V1 on ' || now()::date
      )
    );
    migrated_count := migrated_count + 1;
  END LOOP;

  SELECT count(*) INTO skipped_count FROM public.properties p
  WHERE p.org_id = p_org_id
  AND EXISTS (SELECT 1 FROM public.properties_v2 pv WHERE pv.address_line_1 = p.address_line AND pv.postcode = p.postcode AND pv.org_id = p.org_id);

  RETURN jsonb_build_object('migrated', migrated_count, 'skipped_already_exists', skipped_count, 'unassigned_entity_id', unassigned_entity_id, 'table', 'properties → properties_v2');
END;
$function$;
