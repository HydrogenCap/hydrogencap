
CREATE OR REPLACE FUNCTION public.auto_link_compliance_document_to_requirement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason)
  VALUES (NEW.org_id, NEW.property_id, NEW.document_type, TRUE, 'Auto-created from uploaded document')
  ON CONFLICT (property_id, document_type)
  DO UPDATE SET
    is_required = TRUE,
    override_reason = NULL,
    updated_at = now()
  WHERE public.compliance_requirements_v2.is_required = FALSE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_compliance_doc_to_req ON public.compliance_documents_v2;
CREATE TRIGGER trg_auto_link_compliance_doc_to_req
AFTER INSERT OR UPDATE OF is_current, document_type, property_id ON public.compliance_documents_v2
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_compliance_document_to_requirement();

-- Backfill for existing docs (only for valid requirement types)
INSERT INTO public.compliance_requirements_v2 (org_id, property_id, document_type, is_required, requirement_reason)
SELECT DISTINCT cd.org_id, cd.property_id, cd.document_type, TRUE, 'Auto-created from existing document'
FROM public.compliance_documents_v2 cd
WHERE cd.is_current = TRUE
  AND cd.document_type IN (
    'gas_safety_certificate','epc','eicr','fire_risk_assessment','hmo_licence',
    'selective_licence','buildings_insurance','landlord_liability_insurance',
    'rent_guarantee_insurance','legionella_risk_assessment','asbestos_survey',
    'pat_testing','emergency_lighting_cert','fire_alarm_cert','smoke_co_alarm_cert',
    'furniture_fire_safety'
  )
ON CONFLICT (property_id, document_type) DO NOTHING;
