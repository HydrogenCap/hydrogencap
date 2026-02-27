
-- Migration SQL Functions (tenants_v2 already exists)

-- 2A: Companies → Legal Entities
CREATE OR REPLACE FUNCTION public.migrate_companies_to_entities(p_org_id uuid)
RETURNS jsonb AS $$
DECLARE
  migrated_count integer := 0;
  skipped_count integer := 0;
  rec record;
BEGIN
  FOR rec IN
    SELECT c.* FROM public.companies c
    WHERE c.org_id = p_org_id
    AND NOT EXISTS (
      SELECT 1 FROM public.legal_entities le
      WHERE le.company_number = c.company_number AND le.org_id = c.org_id AND c.company_number IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.legal_entities le
      WHERE le.entity_name = c.legal_name AND le.org_id = c.org_id
    )
  LOOP
    INSERT INTO public.legal_entities (
      entity_name, entity_type, company_number, incorporation_date,
      registered_address, status, org_id, notes
    ) VALUES (
      rec.legal_name,
      CASE
        WHEN rec.company_type IN ('ltd', 'private-limited-guaranty-nsc', 'private-limited-shares-section-30-exemption') THEN 'spv'
        WHEN rec.company_type = 'llp' THEN 'llp'
        WHEN rec.company_type = 'plc' THEN 'plc'
        ELSE 'spv'
      END,
      rec.company_number,
      COALESCE(rec.ch_incorporation_date, rec.created_at)::date,
      rec.ch_registered_address,
      CASE WHEN rec.status = 'active' THEN 'active' WHEN rec.status = 'dissolved' THEN 'dissolved' ELSE 'active' END,
      rec.org_id,
      concat_ws(E'\n',
        CASE WHEN rec.trading_name IS NOT NULL THEN 'Trading name: ' || rec.trading_name END,
        CASE WHEN rec.accounts_due_date IS NOT NULL THEN 'Accounts due: ' || rec.accounts_due_date END,
        CASE WHEN rec.confirmation_statement_due_date IS NOT NULL THEN 'Confirmation due: ' || rec.confirmation_statement_due_date END,
        CASE WHEN rec.jurisdiction IS NOT NULL THEN 'Jurisdiction: ' || rec.jurisdiction END,
        'Migrated from V1 companies table on ' || now()::date
      )
    );
    migrated_count := migrated_count + 1;
  END LOOP;

  SELECT count(*) INTO skipped_count FROM public.companies c
  WHERE c.org_id = p_org_id
  AND (
    EXISTS (SELECT 1 FROM public.legal_entities le WHERE le.company_number = c.company_number AND le.org_id = c.org_id AND c.company_number IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.legal_entities le WHERE le.entity_name = c.legal_name AND le.org_id = c.org_id)
  );

  RETURN jsonb_build_object('migrated', migrated_count, 'skipped_already_exists', skipped_count, 'table', 'companies → legal_entities');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- 2B: Properties → Properties V2
CREATE OR REPLACE FUNCTION public.migrate_properties_to_v2(p_org_id uuid)
RETURNS jsonb AS $$
DECLARE
  migrated_count integer := 0;
  skipped_count integer := 0;
  unassigned_entity_id uuid;
  rec record;
  matched_entity_id uuid;
BEGIN
  SELECT id INTO unassigned_entity_id FROM public.legal_entities
  WHERE entity_name = 'Unassigned (Migration)' AND org_id = p_org_id;

  IF unassigned_entity_id IS NULL THEN
    INSERT INTO public.legal_entities (entity_name, entity_type, status, org_id, notes)
    VALUES ('Unassigned (Migration)', 'personal', 'active', p_org_id, 'Auto-created during V1→V2 migration. Reassign properties to their correct entities.')
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
      COALESCE(rec.property_type, 'hmo_licensed'),
      COALESCE(rec.lifecycle_type, 'stabilised'),
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- 2C: Rooms → Rooms V2
CREATE OR REPLACE FUNCTION public.migrate_rooms_to_v2(p_org_id uuid)
RETURNS jsonb AS $$
DECLARE
  migrated_count integer := 0;
  skipped_count integer := 0;
  rec record;
  v2_property_id uuid;
BEGIN
  FOR rec IN
    SELECT r.*, p.address_line AS prop_address, p.postcode AS prop_postcode
    FROM public.rooms r
    JOIN public.properties p ON p.id = r.property_id
    WHERE r.org_id = p_org_id
    AND NOT EXISTS (
      SELECT 1 FROM public.rooms_v2 rv
      JOIN public.properties_v2 pv ON pv.id = rv.property_id
      WHERE rv.room_name = r.room_name AND pv.address_line_1 = p.address_line AND pv.postcode = p.postcode
    )
  LOOP
    SELECT pv.id INTO v2_property_id
    FROM public.properties_v2 pv
    WHERE pv.address_line_1 = rec.prop_address AND pv.postcode = rec.prop_postcode AND pv.org_id = p_org_id
    LIMIT 1;

    IF v2_property_id IS NULL THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.rooms_v2 (
      property_id, room_name, room_type, floor, target_rent_pcm, occupancy_status, notes
    ) VALUES (
      v2_property_id, rec.room_name,
      COALESCE(rec.room_type::text, 'single'),
      rec.floor, rec.target_rent_pcm,
      CASE WHEN rec.status::text = 'occupied' THEN 'occupied' WHEN rec.status::text = 'vacant' THEN 'vacant' WHEN rec.status::text = 'maintenance' THEN 'refurbishment' ELSE 'vacant' END,
      concat_ws(E'\n', rec.description,
        CASE WHEN rec.square_footage IS NOT NULL THEN 'Floor area: ' || rec.square_footage || ' sq ft' END,
        CASE WHEN rec.amenities IS NOT NULL AND array_length(rec.amenities, 1) > 0 THEN 'Amenities: ' || array_to_string(rec.amenities, ', ') END,
        'Migrated from V1 on ' || now()::date
      )
    );
    migrated_count := migrated_count + 1;
  END LOOP;

  RETURN jsonb_build_object('migrated', migrated_count, 'skipped_no_v2_property', skipped_count, 'table', 'rooms → rooms_v2');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- 2D: Tenants → Tenants V2
CREATE OR REPLACE FUNCTION public.migrate_tenants_to_v2(p_org_id uuid)
RETURNS jsonb AS $$
DECLARE
  migrated_count integer := 0;
  skipped_count integer := 0;
  rec record;
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
    INSERT INTO public.tenants_v2 (
      first_name, last_name, email, phone, date_of_birth, national_insurance,
      emergency_contact_name, emergency_contact_phone, tenant_type, status, org_id, notes
    ) VALUES (
      COALESCE(rec.first_name, 'Unknown'), COALESCE(rec.last_name, 'Unknown'),
      rec.email, rec.phone, rec.date_of_birth, rec.national_insurance,
      rec.emergency_contact_name, rec.emergency_contact_phone,
      COALESCE(rec.tenant_type, 'individual'),
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- 2E: Tenancies → Tenancy Agreements
CREATE OR REPLACE FUNCTION public.migrate_tenancies_to_agreements(p_org_id uuid)
RETURNS jsonb AS $$
DECLARE
  migrated_count integer := 0;
  skipped_count integer := 0;
  rec record;
  v2_property_id uuid;
  v2_room_id uuid;
  v2_tenant_id uuid;
BEGIN
  FOR rec IN
    SELECT tc.*, p.address_line AS prop_address, p.postcode AS prop_postcode,
      r.room_name AS v1_room_name, t.first_name AS v1_first_name, t.last_name AS v1_last_name
    FROM public.tenancies tc
    JOIN public.properties p ON p.id = tc.property_id
    JOIN public.rooms r ON r.id = tc.room_id
    JOIN public.tenants t ON t.id = tc.tenant_id
    WHERE tc.org_id = p_org_id
  LOOP
    SELECT pv.id INTO v2_property_id FROM public.properties_v2 pv
    WHERE pv.address_line_1 = rec.prop_address AND pv.postcode = rec.prop_postcode AND pv.org_id = p_org_id LIMIT 1;

    v2_room_id := NULL;
    IF v2_property_id IS NOT NULL THEN
      SELECT rv.id INTO v2_room_id FROM public.rooms_v2 rv
      WHERE rv.property_id = v2_property_id AND rv.room_name = rec.v1_room_name LIMIT 1;
    END IF;

    SELECT tv.id INTO v2_tenant_id FROM public.tenants_v2 tv
    WHERE tv.first_name = COALESCE(rec.v1_first_name, '') AND tv.last_name = COALESCE(rec.v1_last_name, '') AND tv.org_id = p_org_id LIMIT 1;

    IF v2_property_id IS NULL OR v2_room_id IS NULL OR v2_tenant_id IS NULL THEN
      skipped_count := skipped_count + 1; CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM public.tenancy_agreements ta
      WHERE ta.property_id = v2_property_id AND ta.room_id = v2_room_id AND ta.tenant_id = v2_tenant_id AND ta.start_date = rec.start_date) THEN
      skipped_count := skipped_count + 1; CONTINUE;
    END IF;

    INSERT INTO public.tenancy_agreements (
      property_id, room_id, tenant_id, start_date, initial_end_date, actual_end_date,
      rent_amount_pcm, rent_frequency, tenancy_type, status, deposit_amount,
      deposit_scheme, deposit_reference, deposit_protected_date, org_id, notes
    ) VALUES (
      v2_property_id, v2_room_id, v2_tenant_id, rec.start_date, rec.end_date,
      CASE WHEN rec.status::text IN ('ended', 'departed') THEN rec.end_date ELSE NULL END,
      rec.rent_amount_pcm, 'monthly', 'ast',
      CASE WHEN rec.status::text = 'active' THEN 'active' WHEN rec.status::text = 'periodic' THEN 'periodic'
        WHEN rec.status::text IN ('ended', 'departed') THEN 'ended' WHEN rec.status::text = 'notice' THEN 'notice_served' ELSE 'active' END,
      rec.deposit_amount, rec.deposit_scheme, rec.deposit_reference, rec.deposit_protected_date, rec.org_id,
      concat_ws(E'\n', rec.notes,
        CASE WHEN rec.payment_method IS NOT NULL THEN 'Payment method: ' || rec.payment_method::text END,
        CASE WHEN rec.payment_reference IS NOT NULL THEN 'Payment ref: ' || rec.payment_reference END,
        'Migrated from V1 tenancies on ' || now()::date
      )
    );
    migrated_count := migrated_count + 1;
  END LOOP;

  RETURN jsonb_build_object('migrated', migrated_count, 'skipped_missing_refs_or_exists', skipped_count, 'table', 'tenancies → tenancy_agreements');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- 2F: Compliance Items → Compliance Documents V2
CREATE OR REPLACE FUNCTION public.migrate_compliance_to_v2(p_org_id uuid)
RETURNS jsonb AS $$
DECLARE
  migrated_count integer := 0;
  skipped_count integer := 0;
  rec record;
  v2_property_id uuid;
  doc_url text;
  doc_filename text;
BEGIN
  FOR rec IN
    SELECT ci.*, p.address_line AS prop_address, p.postcode AS prop_postcode
    FROM public.compliance_items ci
    JOIN public.properties p ON p.id = ci.property_id
    WHERE ci.org_id = p_org_id AND ci.issue_date IS NOT NULL
  LOOP
    SELECT pv.id INTO v2_property_id FROM public.properties_v2 pv
    WHERE pv.address_line_1 = rec.prop_address AND pv.postcode = rec.prop_postcode AND pv.org_id = p_org_id LIMIT 1;

    IF v2_property_id IS NULL THEN skipped_count := skipped_count + 1; CONTINUE; END IF;

    IF EXISTS (SELECT 1 FROM public.compliance_documents_v2 cd
      WHERE cd.property_id = v2_property_id AND cd.document_type = rec.compliance_type AND cd.issue_date = rec.issue_date::text) THEN
      skipped_count := skipped_count + 1; CONTINUE;
    END IF;

    SELECT cd.file_url, cd.original_file_name INTO doc_url, doc_filename
    FROM public.compliance_documents cd
    WHERE cd.compliance_item_id = rec.id AND cd.is_current = true LIMIT 1;

    INSERT INTO public.compliance_documents_v2 (
      property_id, document_type, issue_date, expiry_date, status, file_url, file_name, is_current, org_id, notes
    ) VALUES (
      v2_property_id, rec.compliance_type, rec.issue_date::text, rec.expiry_date::text,
      CASE WHEN rec.expiry_date IS NOT NULL AND rec.expiry_date < current_date THEN 'expired' ELSE 'valid' END,
      doc_url, doc_filename,
      CASE WHEN rec.expiry_date IS NULL OR rec.expiry_date >= current_date THEN true ELSE false END,
      rec.org_id,
      concat_ws(E'\n', rec.notes,
        CASE WHEN rec.responsible_party IS NOT NULL THEN 'Responsible: ' || rec.responsible_party END,
        'Migrated from V1 compliance_items on ' || now()::date
      )
    );
    migrated_count := migrated_count + 1;
  END LOOP;

  RETURN jsonb_build_object('migrated', migrated_count, 'skipped', skipped_count, 'table', 'compliance_items → compliance_documents_v2');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- 2G: Master Migration Runner
CREATE OR REPLACE FUNCTION public.run_v1_to_v2_migration(p_org_id uuid)
RETURNS jsonb AS $$
DECLARE
  results jsonb := '[]'::jsonb;
  step_result jsonb;
BEGIN
  SELECT public.migrate_companies_to_entities(p_org_id) INTO step_result;
  results := results || jsonb_build_array(step_result);
  SELECT public.migrate_properties_to_v2(p_org_id) INTO step_result;
  results := results || jsonb_build_array(step_result);
  SELECT public.migrate_rooms_to_v2(p_org_id) INTO step_result;
  results := results || jsonb_build_array(step_result);
  SELECT public.migrate_tenants_to_v2(p_org_id) INTO step_result;
  results := results || jsonb_build_array(step_result);
  SELECT public.migrate_tenancies_to_agreements(p_org_id) INTO step_result;
  results := results || jsonb_build_array(step_result);
  SELECT public.migrate_compliance_to_v2(p_org_id) INTO step_result;
  results := results || jsonb_build_array(step_result);
  RETURN jsonb_build_object('migration_results', results, 'completed_at', now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
