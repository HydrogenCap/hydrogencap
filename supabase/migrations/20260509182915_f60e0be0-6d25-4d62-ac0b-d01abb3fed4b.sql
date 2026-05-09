-- Partial-#61 V2 → canonical rename (4 tables).
--
-- Renames the 4 "clean" V2 tables to their canonical names. These 4 are safe
-- to rename in isolation because their V1 siblings are gone or never existed:
--   compliance_contractors_v2  → compliance_contractors  (V1 sibling: never existed)
--   compliance_requirements_v2 → compliance_requirements (V1 sibling: never existed)
--   property_cost_budgets_v2   → property_cost_budgets   (V1 `costs` dropped 2026-05-04, #49f)
--   property_income_budgets_v2 → property_income_budgets (V1 `income` dropped 2026-05-04, #50b)
--
-- Function bodies that hard-code the old V2 names are rewritten in this same
-- transaction (PG ALTER TABLE RENAME does NOT rewrite function bodies — they
-- compile lazily and would silently break on next call). Views are catalog/OID
-- based and auto-rewire on RENAME, no recreation needed.
--
-- DEFERRED (separate cosmetic ship): function/view names themselves still
-- carry `_v2` suffixes (generate_compliance_requirements_v2,
-- seed_compliance_requirements_v2, trigger_generate_compliance_reqs_v2,
-- migrate_contractors_to_v2, compliance_matrix_v2, portfolio_compliance_score_v2,
-- compliance_documents_v2 column refs). They're called from edge functions and
-- triggers — renaming needs more rewiring than this ship covers.
--
-- The 5 dirty `_v2` tables (properties_v2, rooms_v2, tenants_v2,
-- compliance_documents_v2, share_classes_v2) are explicitly OUT OF SCOPE per
-- Plan §3.1a — they need their §0b cutover first.

BEGIN;

-- ─── Pre-flight: assert the 4 V1 names are unoccupied ────────────────────────
DO $$
BEGIN
  IF to_regclass('public.compliance_contractors')  IS NOT NULL THEN
    RAISE EXCEPTION 'Pre-flight failed: public.compliance_contractors already exists';
  END IF;
  IF to_regclass('public.compliance_requirements') IS NOT NULL THEN
    RAISE EXCEPTION 'Pre-flight failed: public.compliance_requirements already exists';
  END IF;
  IF to_regclass('public.property_cost_budgets')   IS NOT NULL THEN
    RAISE EXCEPTION 'Pre-flight failed: public.property_cost_budgets already exists';
  END IF;
  IF to_regclass('public.property_income_budgets') IS NOT NULL THEN
    RAISE EXCEPTION 'Pre-flight failed: public.property_income_budgets already exists';
  END IF;
END $$;

-- ─── 4 idempotent renames ────────────────────────────────────────────────────
DO $$ BEGIN
  IF to_regclass('public.compliance_contractors_v2') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.compliance_contractors_v2 RENAME TO compliance_contractors';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.compliance_requirements_v2') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.compliance_requirements_v2 RENAME TO compliance_requirements';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.property_cost_budgets_v2') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.property_cost_budgets_v2 RENAME TO property_cost_budgets';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.property_income_budgets_v2') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.property_income_budgets_v2 RENAME TO property_income_budgets';
  END IF;
END $$;

-- ─── Function-body rewrites (6 functions touching the 4 renamed tables) ──────

CREATE OR REPLACE FUNCTION public.generate_compliance_requirements_v2(target_property_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prop RECORD;
BEGIN
  SELECT * INTO prop FROM public.properties_v2 WHERE id = target_property_id;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.compliance_requirements (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
  VALUES
    (prop.org_id, target_property_id, 'epc', true, 'Required for all rental properties', 120, 30),
    (prop.org_id, target_property_id, 'eicr', true, 'Required for all rental properties (5-year cycle)', 60, 30),
    (prop.org_id, target_property_id, 'buildings_insurance', true, 'Required for all properties', 12, 30)
  ON CONFLICT (property_id, document_type) DO NOTHING;

  IF prop.has_fire_alarm_system IS TRUE THEN
    INSERT INTO public.compliance_requirements (org_id, property_id, document_type, is_required, requirement_reason, override_reason)
    VALUES (prop.org_id, target_property_id, 'smoke_co_alarm_cert', false, 'Smoke and CO Alarm Regulations', 'Property has integrated fire alarm system - standalone smoke/CO alarms not required')
    ON CONFLICT (property_id, document_type) DO UPDATE SET is_required = false, override_reason = 'Property has integrated fire alarm system - standalone smoke/CO alarms not required';
  ELSE
    INSERT INTO public.compliance_requirements (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
    VALUES (prop.org_id, target_property_id, 'smoke_co_alarm_cert', true, 'Required under Smoke and CO Alarm Regulations', 12, 14)
    ON CONFLICT (property_id, document_type) DO NOTHING;
  END IF;

  IF prop.has_gas_supply IS TRUE THEN
    INSERT INTO public.compliance_requirements (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
    VALUES (prop.org_id, target_property_id, 'gas_safety_certificate', true, 'Gas supply present - annual CP12 required', 12, 30)
    ON CONFLICT (property_id, document_type) DO NOTHING;
  ELSE
    INSERT INTO public.compliance_requirements (org_id, property_id, document_type, is_required, requirement_reason, override_reason)
    VALUES (prop.org_id, target_property_id, 'gas_safety_certificate', false, 'Gas Safety Regulations', 'No gas supply to property')
    ON CONFLICT (property_id, document_type) DO UPDATE SET is_required = false, override_reason = 'No gas supply to property';
  END IF;

  IF prop.property_type IN ('hmo_licensed', 'hmo_mandatory') THEN
    INSERT INTO public.compliance_requirements (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
    VALUES
      (prop.org_id, target_property_id, 'hmo_licence', true, 'HMO property requires licence', 60, 90),
      (prop.org_id, target_property_id, 'fire_risk_assessment', true, 'Required for all HMOs', 12, 30),
      (prop.org_id, target_property_id, 'emergency_lighting_cert', true, 'Required for all HMOs', 12, 30),
      (prop.org_id, target_property_id, 'fire_alarm_cert', true, 'Required for all HMOs', 12, 30),
      (prop.org_id, target_property_id, 'furniture_fire_safety', false, 'Optional - not required by default', 0, 14),
      (prop.org_id, target_property_id, 'pat_testing', false, 'Optional - not required by default', 12, 30),
      (prop.org_id, target_property_id, 'legionella_risk_assessment', false, 'Optional - not required by default', 24, 30),
      (prop.org_id, target_property_id, 'asbestos_survey', false, 'Optional - not required by default', 0, 30),
      (prop.org_id, target_property_id, 'landlord_liability_insurance', true, 'Strongly recommended for HMOs', 12, 30)
    ON CONFLICT (property_id, document_type) DO NOTHING;
  END IF;

  IF prop.property_type = 'single_let' THEN
    INSERT INTO public.compliance_requirements (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
    VALUES
      (prop.org_id, target_property_id, 'fire_risk_assessment', false, 'Not mandatory for single lets', NULL, NULL),
      (prop.org_id, target_property_id, 'legionella_risk_assessment', false, 'Optional - not required by default', 24, 30),
      (prop.org_id, target_property_id, 'landlord_liability_insurance', true, 'Strongly recommended', 12, 30)
    ON CONFLICT (property_id, document_type) DO NOTHING;
  END IF;

  IF prop.listing_grade != 'none' THEN
    UPDATE public.compliance_requirements
    SET notes = 'Listed building (' || prop.listing_grade || ') - check alternative compliance routes with conservation officer'
    WHERE property_id = target_property_id
      AND document_type IN ('fire_alarm_cert', 'emergency_lighting_cert', 'eicr');
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.seed_compliance_requirements_v2(target_property_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prop RECORD;
BEGIN
  SELECT p.org_id, p.has_gas_supply, p.property_type, p.has_fire_alarm_system
  INTO prop
  FROM properties_v2 p
  WHERE p.id = target_property_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property % not found', target_property_id;
  END IF;

  INSERT INTO public.compliance_requirements (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
  VALUES
    (prop.org_id, target_property_id, 'epc', true, 'Required for all rental properties', 120, 30),
    (prop.org_id, target_property_id, 'eicr', true, 'Required for all rental properties (5-year cycle)', 60, 30),
    (prop.org_id, target_property_id, 'buildings_insurance', true, 'Required for all properties', 12, 30)
  ON CONFLICT (property_id, document_type) DO NOTHING;

  IF prop.has_fire_alarm_system IS TRUE THEN
    INSERT INTO public.compliance_requirements (org_id, property_id, document_type, is_required, requirement_reason, override_reason)
    VALUES (prop.org_id, target_property_id, 'smoke_co_alarm_cert', false, 'Smoke and CO Alarm Regulations', 'Property has integrated fire alarm system - standalone smoke/CO alarms not required')
    ON CONFLICT (property_id, document_type) DO UPDATE SET is_required = false, override_reason = 'Property has integrated fire alarm system - standalone smoke/CO alarms not required';
  ELSE
    INSERT INTO public.compliance_requirements (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
    VALUES (prop.org_id, target_property_id, 'smoke_co_alarm_cert', true, 'Required under Smoke and CO Alarm Regulations', 12, 14)
    ON CONFLICT (property_id, document_type) DO NOTHING;
  END IF;

  IF prop.has_gas_supply IS TRUE THEN
    INSERT INTO public.compliance_requirements (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
    VALUES (prop.org_id, target_property_id, 'gas_safety_certificate', true, 'Gas supply present - annual CP12 required', 12, 30)
    ON CONFLICT (property_id, document_type) DO NOTHING;
  ELSE
    INSERT INTO public.compliance_requirements (org_id, property_id, document_type, is_required, requirement_reason, override_reason)
    VALUES (prop.org_id, target_property_id, 'gas_safety_certificate', false, 'Gas Safety Regulations', 'No gas supply to property')
    ON CONFLICT (property_id, document_type) DO UPDATE SET is_required = false, override_reason = 'No gas supply to property';
  END IF;

  IF prop.property_type IN ('hmo_licensed', 'hmo_mandatory') THEN
    INSERT INTO public.compliance_requirements (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
    VALUES
      (prop.org_id, target_property_id, 'hmo_licence', true, 'HMO property requires licence', 60, 90),
      (prop.org_id, target_property_id, 'fire_risk_assessment', true, 'Required for all HMOs', 12, 30),
      (prop.org_id, target_property_id, 'emergency_lighting_cert', true, 'Required for all HMOs', 12, 30),
      (prop.org_id, target_property_id, 'fire_alarm_cert', true, 'Required for all HMOs', 12, 30),
      (prop.org_id, target_property_id, 'furniture_fire_safety', false, 'Optional - not required by default', 0, 14),
      (prop.org_id, target_property_id, 'pat_testing', false, 'Optional - not required by default', 12, 30),
      (prop.org_id, target_property_id, 'legionella_risk_assessment', false, 'Optional - not required by default', 24, 30),
      (prop.org_id, target_property_id, 'asbestos_survey', false, 'Optional - not required by default', 0, 30),
      (prop.org_id, target_property_id, 'landlord_liability_insurance', true, 'Strongly recommended for HMOs', 12, 30)
    ON CONFLICT (property_id, document_type) DO NOTHING;
  END IF;

  IF prop.property_type = 'single_let' THEN
    INSERT INTO public.compliance_requirements (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
    VALUES
      (prop.org_id, target_property_id, 'fire_risk_assessment', false, 'Not mandatory for single lets', NULL, NULL),
      (prop.org_id, target_property_id, 'legionella_risk_assessment', false, 'Optional - not required by default', 24, 30),
      (prop.org_id, target_property_id, 'landlord_liability_insurance', true, 'Strongly recommended', 12, 30)
    ON CONFLICT (property_id, document_type) DO NOTHING;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_link_compliance_document_to_requirement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_current IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.document_type NOT IN (
    'gas_safety_certificate','epc','eicr','fire_risk_assessment','hmo_licence',
    'selective_licence','buildings_insurance','landlord_liability_insurance',
    'rent_guarantee_insurance','legionella_risk_assessment','asbestos_survey',
    'pat_testing','emergency_lighting_cert','fire_alarm_cert','smoke_co_alarm_cert',
    'furniture_fire_safety'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.compliance_requirements (org_id, property_id, document_type, is_required, requirement_reason)
  VALUES (NEW.org_id, NEW.property_id, NEW.document_type, TRUE, 'Auto-created from uploaded document')
  ON CONFLICT (property_id, document_type)
  DO UPDATE SET
    is_required = TRUE,
    override_reason = NULL,
    updated_at = now()
  WHERE public.compliance_requirements.is_required = FALSE;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_waive_smoke_co_on_fire_alarm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.document_type = 'fire_alarm_cert' AND NEW.file_name IS NOT NULL AND NEW.property_id IS NOT NULL THEN
    UPDATE public.compliance_requirements
    SET is_required = false,
        override_reason = 'Covered by Fire Alarm Certificate',
        updated_at = now()
    WHERE property_id = NEW.property_id
      AND document_type = 'smoke_co_alarm_cert'
      AND is_required = true;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.migrate_contractors_to_v2(p_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
      SELECT 1 FROM public.compliance_contractors cv
      WHERE cv.company_name = COALESCE(c.company_name, c.name) AND cv.org_id = c.org_id
    )
  LOOP
    v_rating := CASE
      WHEN rec.average_rating IS NULL OR rec.average_rating < 1 THEN NULL
      WHEN rec.average_rating > 5 THEN 5
      ELSE rec.average_rating
    END;

    INSERT INTO public.compliance_contractors (
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

  RETURN jsonb_build_object('migrated', migrated_count, 'skipped', skipped_count, 'table', 'contractors → compliance_contractors');
END;
$function$;

CREATE OR REPLACE FUNCTION public.v1_freeze_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v2_target text;
BEGIN
  v2_target := CASE TG_TABLE_NAME
    WHEN 'properties' THEN 'properties_v2'
    WHEN 'rooms'      THEN 'rooms_v2'
    WHEN 'tenants'    THEN 'tenants_v2'
    WHEN 'loans'      THEN 'loan_facilities'
    WHEN 'costs'      THEN 'property_cost_budgets'
    WHEN 'tenancies'  THEN 'tenancy_agreements'
    ELSE TG_TABLE_NAME || '_v2'
  END;

  BEGIN
    INSERT INTO public.v1_freeze_violations
      (table_name, query_fragment, db_session_user, attempted_op, error_code)
    VALUES (
      TG_TABLE_NAME,
      left(coalesce(current_query(), ''), 1024),
      session_user,
      lower(TG_OP),
      '23514'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RAISE EXCEPTION 'V1 table % is frozen — write to % instead', TG_TABLE_NAME, v2_target
    USING ERRCODE = 'check_violation';
END;
$function$;

COMMIT;