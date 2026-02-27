
-- Update existing requirements to not required by default
UPDATE public.compliance_requirements_v2
SET is_required = false, override_reason = 'Not required by default'
WHERE document_type IN ('pat_testing', 'legionella_risk_assessment', 'asbestos_survey', 'furniture_fire_safety')
  AND is_required = true
  AND override_reason IS NULL;

-- Update the seed function to make these not required by default
CREATE OR REPLACE FUNCTION public.seed_compliance_requirements_v2(target_property_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prop RECORD;
BEGIN
  SELECT p.org_id, p.has_gas_supply, p.property_type
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
    (prop.org_id, target_property_id, 'buildings_insurance', true, 'Required for all properties', 12, 30),
    (prop.org_id, target_property_id, 'smoke_co_alarm_cert', true, 'Required under Smoke and CO Alarm Regulations', 12, 14)
  ON CONFLICT (property_id, document_type) DO NOTHING;

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
