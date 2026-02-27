
CREATE OR REPLACE FUNCTION public.migrate_tenants_to_v2(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  migrated_count integer := 0;
  skipped_count integer := 0;
  rec record;
  v_tenant_type text;
BEGIN
  FOR rec IN
    SELECT t.* FROM public.tenants t
    WHERE t.org_id = p_org_id
    AND NOT EXISTS (
      SELECT 1 FROM public.tenants_v2 tv
      WHERE tv.first_name = COALESCE(t.first_name, '') AND tv.last_name = COALESCE(t.last_name, '') AND tv.org_id = t.org_id
    )
    AND COALESCE(t.first_name, '') != ''
  LOOP
    -- Map V1 tenant_type to valid V2 values
    v_tenant_type := CASE
      WHEN rec.tenant_type IN ('private', 'dss_hb', 'uc', 'council_placement', 'supported_housing') THEN rec.tenant_type
      WHEN rec.tenant_type IN ('company', 'corporate', 'business') THEN 'private'
      WHEN rec.tenant_type IN ('dss', 'housing_benefit', 'hb') THEN 'dss_hb'
      WHEN rec.tenant_type IN ('universal_credit') THEN 'uc'
      WHEN rec.tenant_type IN ('council', 'local_authority') THEN 'council_placement'
      ELSE 'private'
    END;

    INSERT INTO public.tenants_v2 (
      first_name, last_name, email, phone, date_of_birth, national_insurance,
      emergency_contact_name, emergency_contact_phone, tenant_type, status, org_id, notes
    ) VALUES (
      COALESCE(rec.first_name, 'Unknown'), COALESCE(rec.last_name, 'Unknown'),
      rec.email, rec.phone, rec.date_of_birth, rec.national_insurance,
      rec.emergency_contact_name, rec.emergency_contact_phone,
      v_tenant_type,
      CASE
        WHEN rec.status::text = 'active' THEN 'active'
        WHEN rec.status::text IN ('pending', 'prospect') THEN 'applicant'
        WHEN rec.status::text IN ('ended', 'departed', 'inactive', 'past') THEN 'departed'
        ELSE 'active'
      END,
      rec.org_id,
      concat_ws(E'\n', rec.notes,
        CASE WHEN rec.employer_name IS NOT NULL THEN 'Employer: ' || rec.employer_name END,
        CASE WHEN rec.guarantor_name IS NOT NULL THEN 'Guarantor: ' || rec.guarantor_name || COALESCE(' (' || rec.guarantor_phone || ')', '') END,
        CASE WHEN rec.previous_address IS NOT NULL THEN 'Previous address: ' || rec.previous_address END,
        CASE WHEN rec.company_name IS NOT NULL THEN 'Company tenant: ' || rec.company_name END,
        'Migrated from V1 on ' || now()::date
      )
    );
    migrated_count := migrated_count + 1;
  END LOOP;

  SELECT count(*) INTO skipped_count FROM public.tenants t
  WHERE t.org_id = p_org_id
  AND EXISTS (SELECT 1 FROM public.tenants_v2 tv WHERE tv.first_name = COALESCE(t.first_name, '') AND tv.last_name = COALESCE(t.last_name, '') AND tv.org_id = t.org_id);

  RETURN jsonb_build_object('migrated', migrated_count, 'skipped_already_exists', skipped_count, 'table', 'tenants → tenants_v2');
END;
$function$;
