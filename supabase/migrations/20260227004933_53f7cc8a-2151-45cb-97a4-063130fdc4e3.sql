
-- Fix migrate_compliance_to_v2: map V1 compliance_type display names to V2 enum values
CREATE OR REPLACE FUNCTION public.migrate_compliance_to_v2(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  migrated_count integer := 0;
  skipped_count integer := 0;
  rec record;
  v2_property_id uuid;
  doc_url text;
  doc_filename text;
  v_doc_type text;
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

    -- Map V1 display names to V2 enum values
    v_doc_type := CASE
      WHEN rec.compliance_type ILIKE '%gas%safety%' THEN 'gas_safety_certificate'
      WHEN rec.compliance_type ILIKE '%epc%' OR rec.compliance_type ILIKE '%energy%performance%' THEN 'epc'
      WHEN rec.compliance_type ILIKE '%eicr%' OR rec.compliance_type ILIKE '%electrical%safety%' THEN 'eicr'
      WHEN rec.compliance_type ILIKE '%fire%risk%' THEN 'fire_risk_assessment'
      WHEN rec.compliance_type ILIKE '%hmo%licence%' THEN 'hmo_licence'
      WHEN rec.compliance_type ILIKE '%selective%licence%' THEN 'selective_licence'
      WHEN rec.compliance_type ILIKE '%building%insurance%' THEN 'buildings_insurance'
      WHEN rec.compliance_type ILIKE '%landlord%liability%' THEN 'landlord_liability_insurance'
      WHEN rec.compliance_type ILIKE '%rent%guarantee%' THEN 'rent_guarantee_insurance'
      WHEN rec.compliance_type ILIKE '%legionella%' THEN 'legionella_risk_assessment'
      WHEN rec.compliance_type ILIKE '%asbestos%' THEN 'asbestos_survey'
      WHEN rec.compliance_type ILIKE '%pat%test%' THEN 'pat_testing'
      WHEN rec.compliance_type ILIKE '%emergency%light%' THEN 'emergency_lighting_cert'
      WHEN rec.compliance_type ILIKE '%fire%alarm%' THEN 'fire_alarm_cert'
      WHEN rec.compliance_type ILIKE '%smoke%' OR rec.compliance_type ILIKE '%co%alarm%' THEN 'smoke_co_alarm_cert'
      WHEN rec.compliance_type ILIKE '%furniture%fire%' THEN 'furniture_fire_safety'
      WHEN rec.compliance_type ILIKE '%planning%' THEN 'planning_permission'
      WHEN rec.compliance_type ILIKE '%building%reg%' THEN 'building_regs_completion'
      WHEN rec.compliance_type ILIKE '%fire%suppression%' THEN 'other'
      WHEN rec.compliance_type ILIKE '%mcs%' THEN 'other'
      WHEN rec.compliance_type IN ('gas_safety_certificate','epc','eicr','fire_risk_assessment','hmo_licence','selective_licence','buildings_insurance','landlord_liability_insurance','rent_guarantee_insurance','legionella_risk_assessment','asbestos_survey','pat_testing','emergency_lighting_cert','fire_alarm_cert','smoke_co_alarm_cert','furniture_fire_safety','energy_performance_certificate','planning_permission','building_regs_completion','other') THEN rec.compliance_type
      ELSE 'other'
    END;

    IF EXISTS (SELECT 1 FROM public.compliance_documents_v2 cd
      WHERE cd.property_id = v2_property_id AND cd.document_type = v_doc_type AND cd.issue_date = rec.issue_date) THEN
      skipped_count := skipped_count + 1; CONTINUE;
    END IF;

    SELECT cd.file_url, cd.original_file_name INTO doc_url, doc_filename
    FROM public.compliance_documents cd
    WHERE cd.compliance_item_id = rec.id AND cd.is_current = true LIMIT 1;

    INSERT INTO public.compliance_documents_v2 (
      property_id, document_type, issue_date, expiry_date, status, file_url, file_name, is_current, org_id, notes
    ) VALUES (
      v2_property_id, v_doc_type, rec.issue_date, rec.expiry_date,
      CASE WHEN rec.expiry_date IS NOT NULL AND rec.expiry_date < current_date THEN 'expired' ELSE 'valid' END,
      doc_url, doc_filename,
      CASE WHEN rec.expiry_date IS NULL OR rec.expiry_date >= current_date THEN true ELSE false END,
      rec.org_id,
      concat_ws(E'\n', rec.notes,
        CASE WHEN rec.responsible_party IS NOT NULL THEN 'Responsible: ' || rec.responsible_party END,
        'Original type: ' || rec.compliance_type,
        'Migrated from V1 compliance_items on ' || now()::date
      )
    );
    migrated_count := migrated_count + 1;
  END LOOP;

  RETURN jsonb_build_object('migrated', migrated_count, 'skipped', skipped_count, 'table', 'compliance_items → compliance_documents_v2');
END;
$function$;
