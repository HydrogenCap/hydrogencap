
-- Add fire alarm column to properties_v2
ALTER TABLE public.properties_v2 ADD COLUMN IF NOT EXISTS has_fire_alarm_system boolean DEFAULT false;

-- Update generate function to handle fire alarm → smoke/CO exemption
CREATE OR REPLACE FUNCTION public.generate_compliance_requirements_v2(target_property_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prop RECORD;
BEGIN
  SELECT * INTO prop FROM public.properties_v2 WHERE id = target_property_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Universal requirements
  INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
  VALUES
    (prop.org_id, target_property_id, 'epc', true, 'Required for all rental properties', 120, 30),
    (prop.org_id, target_property_id, 'eicr', true, 'Required for all rental properties (5-year cycle)', 60, 30),
    (prop.org_id, target_property_id, 'buildings_insurance', true, 'Required for all properties', 12, 30)
  ON CONFLICT (property_id, document_type) DO NOTHING;

  -- Smoke & CO alarm: NOT required if property has fire alarm system
  IF prop.has_fire_alarm_system IS TRUE THEN
    INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, override_reason)
    VALUES (prop.org_id, target_property_id, 'smoke_co_alarm_cert', false, 'Smoke and CO Alarm Regulations', 'Property has integrated fire alarm system - standalone smoke/CO alarms not required')
    ON CONFLICT (property_id, document_type) DO UPDATE SET is_required = false, override_reason = 'Property has integrated fire alarm system - standalone smoke/CO alarms not required';
  ELSE
    INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
    VALUES (prop.org_id, target_property_id, 'smoke_co_alarm_cert', true, 'Required under Smoke and CO Alarm Regulations', 12, 14)
    ON CONFLICT (property_id, document_type) DO NOTHING;
  END IF;

  -- Gas safety (conditional)
  IF prop.has_gas_supply IS TRUE THEN
    INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
    VALUES (prop.org_id, target_property_id, 'gas_safety_certificate', true, 'Gas supply present - annual CP12 required', 12, 30)
    ON CONFLICT (property_id, document_type) DO NOTHING;
  ELSE
    INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, override_reason)
    VALUES (prop.org_id, target_property_id, 'gas_safety_certificate', false, 'Gas Safety Regulations', 'No gas supply to property')
    ON CONFLICT (property_id, document_type) DO UPDATE SET is_required = false, override_reason = 'No gas supply to property';
  END IF;

  -- HMO-specific
  IF prop.property_type IN ('hmo_licensed', 'hmo_mandatory') THEN
    INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
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

  -- Single let
  IF prop.property_type = 'single_let' THEN
    INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
    VALUES
      (prop.org_id, target_property_id, 'fire_risk_assessment', false, 'Not mandatory for single lets', NULL, NULL),
      (prop.org_id, target_property_id, 'legionella_risk_assessment', false, 'Optional - not required by default', 24, 30),
      (prop.org_id, target_property_id, 'landlord_liability_insurance', true, 'Strongly recommended', 12, 30)
    ON CONFLICT (property_id, document_type) DO NOTHING;
  END IF;

  -- Listed building notes
  IF prop.listing_grade != 'none' THEN
    UPDATE public.compliance_requirements_v2
    SET notes = 'Listed building (' || prop.listing_grade || ') - check alternative compliance routes with conservation officer'
    WHERE property_id = target_property_id
      AND document_type IN ('fire_alarm_cert', 'emergency_lighting_cert', 'eicr');
  END IF;
END;
$$;

-- Update seed function similarly
CREATE OR REPLACE FUNCTION public.seed_compliance_requirements_v2(target_property_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Universal requirements
  INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
  VALUES
    (prop.org_id, target_property_id, 'epc', true, 'Required for all rental properties', 120, 30),
    (prop.org_id, target_property_id, 'eicr', true, 'Required for all rental properties (5-year cycle)', 60, 30),
    (prop.org_id, target_property_id, 'buildings_insurance', true, 'Required for all properties', 12, 30)
  ON CONFLICT (property_id, document_type) DO NOTHING;

  -- Smoke & CO alarm: NOT required if property has fire alarm system
  IF prop.has_fire_alarm_system IS TRUE THEN
    INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, override_reason)
    VALUES (prop.org_id, target_property_id, 'smoke_co_alarm_cert', false, 'Smoke and CO Alarm Regulations', 'Property has integrated fire alarm system - standalone smoke/CO alarms not required')
    ON CONFLICT (property_id, document_type) DO UPDATE SET is_required = false, override_reason = 'Property has integrated fire alarm system - standalone smoke/CO alarms not required';
  ELSE
    INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
    VALUES (prop.org_id, target_property_id, 'smoke_co_alarm_cert', true, 'Required under Smoke and CO Alarm Regulations', 12, 14)
    ON CONFLICT (property_id, document_type) DO NOTHING;
  END IF;

  -- Gas safety (conditional)
  IF prop.has_gas_supply IS TRUE THEN
    INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
    VALUES (prop.org_id, target_property_id, 'gas_safety_certificate', true, 'Gas supply present - annual CP12 required', 12, 30)
    ON CONFLICT (property_id, document_type) DO NOTHING;
  ELSE
    INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, override_reason)
    VALUES (prop.org_id, target_property_id, 'gas_safety_certificate', false, 'Gas Safety Regulations', 'No gas supply to property')
    ON CONFLICT (property_id, document_type) DO UPDATE SET is_required = false, override_reason = 'No gas supply to property';
  END IF;

  -- HMO-specific
  IF prop.property_type IN ('hmo_licensed', 'hmo_mandatory') THEN
    INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
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

  -- Single let
  IF prop.property_type = 'single_let' THEN
    INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason, review_frequency_months, lead_time_days)
    VALUES
      (prop.org_id, target_property_id, 'fire_risk_assessment', false, 'Not mandatory for single lets', NULL, NULL),
      (prop.org_id, target_property_id, 'legionella_risk_assessment', false, 'Optional - not required by default', 24, 30),
      (prop.org_id, target_property_id, 'landlord_liability_insurance', true, 'Strongly recommended', 12, 30)
    ON CONFLICT (property_id, document_type) DO NOTHING;
  END IF;
END;
$$;

-- Update trigger to also re-evaluate when has_fire_alarm_system changes
CREATE OR REPLACE FUNCTION public.trigger_generate_compliance_reqs_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.generate_compliance_requirements_v2(NEW.id);
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.property_type IS DISTINCT FROM NEW.property_type
      OR OLD.has_gas_supply IS DISTINCT FROM NEW.has_gas_supply
      OR OLD.listing_grade IS DISTINCT FROM NEW.listing_grade
      OR OLD.has_fire_alarm_system IS DISTINCT FROM NEW.has_fire_alarm_system THEN
      PERFORM public.generate_compliance_requirements_v2(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Update existing properties that have fire alarm (from V1 data) and mark smoke/CO as not required
UPDATE public.compliance_requirements_v2 cr
SET is_required = false, override_reason = 'Property has integrated fire alarm system - standalone smoke/CO alarms not required'
FROM public.properties_v2 p
WHERE cr.property_id = p.id
  AND cr.document_type = 'smoke_co_alarm_cert'
  AND p.has_fire_alarm_system = true
  AND cr.is_required = true;
