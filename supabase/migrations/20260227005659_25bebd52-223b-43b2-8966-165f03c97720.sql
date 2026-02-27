
-- Fix migrate_contractors_to_v2: handle rating=0 by converting to NULL (constraint requires 1-5)
CREATE OR REPLACE FUNCTION public.migrate_contractors_to_v2(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  migrated_count integer := 0;
  skipped_count integer := 0;
  rec record;
  v_rating numeric;
BEGIN
  FOR rec IN
    SELECT c.* FROM public.contractors c
    WHERE c.org_id = p_org_id
    AND NOT EXISTS (
      SELECT 1 FROM public.compliance_contractors_v2 cv
      WHERE cv.company_name = COALESCE(c.company_name, c.name) AND cv.org_id = c.org_id
    )
  LOOP
    -- Clamp rating to 1-5 range, or NULL if 0/null
    v_rating := CASE
      WHEN rec.average_rating IS NULL OR rec.average_rating < 1 THEN NULL
      WHEN rec.average_rating > 5 THEN 5
      ELSE rec.average_rating
    END;

    INSERT INTO public.compliance_contractors_v2 (
      company_name, contact_name, email, phone,
      service_types, is_preferred, rating, coverage_area,
      notes, org_id
    ) VALUES (
      COALESCE(rec.company_name, rec.name),
      rec.name,
      rec.email,
      rec.phone,
      COALESCE(rec.compliance_types, ARRAY[]::text[]),
      rec.is_preferred,
      v_rating,
      CASE WHEN rec.service_areas IS NOT NULL THEN array_to_string(rec.service_areas, ', ') ELSE NULL END,
      concat_ws(E'\n', rec.notes,
        CASE WHEN rec.website IS NOT NULL THEN 'Website: ' || rec.website END,
        CASE WHEN rec.hourly_rate_gbp IS NOT NULL THEN 'Hourly rate: £' || rec.hourly_rate_gbp END,
        CASE WHEN rec.call_out_fee_gbp IS NOT NULL THEN 'Call-out fee: £' || rec.call_out_fee_gbp END,
        'Migrated from V1 contractors on ' || now()::date
      ),
      rec.org_id
    );
    migrated_count := migrated_count + 1;
  END LOOP;

  RETURN jsonb_build_object('migrated', migrated_count, 'skipped', skipped_count, 'table', 'contractors → compliance_contractors_v2');
END;
$function$;
