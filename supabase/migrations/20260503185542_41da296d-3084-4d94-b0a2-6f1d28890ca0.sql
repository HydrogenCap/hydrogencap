
DO $$
DECLARE
  promoted_count int := 0;
  inserted_current int := 0;
  inserted_history int := 0;
BEGIN
  -- Step A: promote high-confidence property suggestions
  WITH promotable AS (
    SELECT id, ai_suggested_property_id
    FROM public.documents
    WHERE property_id IS NULL
      AND ai_suggested_property_id IS NOT NULL
      AND COALESCE(ai_property_confidence, 0) >= 0.80
      AND ai_suggested_doc_type IN (
        'gas_safety_certificate','electrical_certificate','epc_certificate',
        'fire_alarm_certificate','emergency_lighting_certificate','fire_suppression_certificate',
        'pat_testing','fire_risk_assessment','hmo_licence',
        'building_insurance','public_liability_insurance','asbestos_survey',
        'legionella_assessment','fire_door_certification','fire_panel_commissioning',
        'mcs_certificate'
      )
  ), upd AS (
    UPDATE public.documents d
       SET property_id = p.ai_suggested_property_id
      FROM promotable p
     WHERE d.id = p.id
    RETURNING d.id
  )
  SELECT count(*) INTO promoted_count FROM upd;

  -- Build a working set with mapped type and per-(property,type) recency rank
  CREATE TEMP TABLE _vault_candidates ON COMMIT DROP AS
  SELECT
    d.id AS document_id,
    d.org_id,
    d.property_id,
    CASE d.ai_suggested_doc_type
      WHEN 'gas_safety_certificate' THEN 'gas_safety_certificate'
      WHEN 'electrical_certificate' THEN 'eicr'
      WHEN 'epc_certificate' THEN 'epc'
      WHEN 'fire_alarm_certificate' THEN 'fire_alarm_cert'
      WHEN 'emergency_lighting_certificate' THEN 'emergency_lighting_cert'
      WHEN 'pat_testing' THEN 'pat_testing'
      WHEN 'fire_risk_assessment' THEN 'fire_risk_assessment'
      WHEN 'hmo_licence' THEN 'hmo_licence'
      WHEN 'building_insurance' THEN 'buildings_insurance'
      WHEN 'public_liability_insurance' THEN 'landlord_liability_insurance'
      WHEN 'asbestos_survey' THEN 'asbestos_survey'
      WHEN 'legionella_assessment' THEN 'legionella_risk_assessment'
      ELSE 'other'
    END AS document_type,
    COALESCE(d.extracted_issue_date, d.document_date, d.created_at::date) AS issue_date,
    d.expiry_date,
    d.extracted_reference_number AS certificate_number,
    COALESCE(d.extracted_certifier_company, d.extracted_certifier_name) AS issuer_name,
    d.file_url,
    COALESCE(d.final_file_name, d.original_file_name, d.display_name) AS file_name,
    d.ai_doc_type_confidence AS ai_confidence_score,
    d.uploaded_by,
    d.created_at,
    CASE
      WHEN d.expiry_date IS NULL THEN 'valid'
      WHEN d.expiry_date < CURRENT_DATE THEN 'expired'
      WHEN d.expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'critical'
      WHEN d.expiry_date < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_soon'
      ELSE 'valid'
    END AS status_calc,
    ROW_NUMBER() OVER (
      PARTITION BY d.property_id, (
        CASE d.ai_suggested_doc_type
          WHEN 'gas_safety_certificate' THEN 'gas_safety_certificate'
          WHEN 'electrical_certificate' THEN 'eicr'
          WHEN 'epc_certificate' THEN 'epc'
          WHEN 'fire_alarm_certificate' THEN 'fire_alarm_cert'
          WHEN 'emergency_lighting_certificate' THEN 'emergency_lighting_cert'
          WHEN 'pat_testing' THEN 'pat_testing'
          WHEN 'fire_risk_assessment' THEN 'fire_risk_assessment'
          WHEN 'hmo_licence' THEN 'hmo_licence'
          WHEN 'building_insurance' THEN 'buildings_insurance'
          WHEN 'public_liability_insurance' THEN 'landlord_liability_insurance'
          WHEN 'asbestos_survey' THEN 'asbestos_survey'
          WHEN 'legionella_assessment' THEN 'legionella_risk_assessment'
          ELSE 'other'
        END
      )
      ORDER BY COALESCE(d.extracted_issue_date, d.document_date, d.created_at::date) DESC, d.created_at DESC
    ) AS rn
  FROM public.documents d
  WHERE d.property_id IS NOT NULL
    AND d.org_id IS NOT NULL
    AND d.file_url IS NOT NULL
    AND d.deleted_at IS NULL
    AND d.ai_suggested_doc_type IN (
      'gas_safety_certificate','electrical_certificate','epc_certificate',
      'fire_alarm_certificate','emergency_lighting_certificate','fire_suppression_certificate',
      'pat_testing','fire_risk_assessment','hmo_licence',
      'building_insurance','public_liability_insurance','asbestos_survey',
      'legionella_assessment','fire_door_certification','fire_panel_commissioning',
      'mcs_certificate'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.compliance_documents_v2 c WHERE c.file_url = d.file_url
    );

  -- Step B1: insert the newest doc per (property,type) as is_current,
  --          but only if no current row already exists for that pair.
  WITH ins AS (
    INSERT INTO public.compliance_documents_v2 (
      org_id, property_id, document_type, issue_date, expiry_date,
      certificate_number, issuer_name, file_url, file_name, status,
      ai_extracted, ai_confidence_score, is_current, uploaded_by, uploaded_at, notes
    )
    SELECT
      v.org_id, v.property_id, v.document_type, v.issue_date, v.expiry_date,
      v.certificate_number, v.issuer_name, v.file_url, v.file_name, v.status_calc,
      true, v.ai_confidence_score, true, v.uploaded_by, v.created_at,
      'Backfilled from Document Vault'
    FROM _vault_candidates v
    WHERE v.rn = 1
      AND NOT EXISTS (
        SELECT 1 FROM public.compliance_documents_v2 c
         WHERE c.property_id = v.property_id
           AND c.document_type = v.document_type
           AND c.is_current = true
      )
    RETURNING id
  )
  SELECT count(*) INTO inserted_current FROM ins;

  -- Step B2: insert older docs per (property,type) as historical (is_current=false)
  WITH ins2 AS (
    INSERT INTO public.compliance_documents_v2 (
      org_id, property_id, document_type, issue_date, expiry_date,
      certificate_number, issuer_name, file_url, file_name, status,
      ai_extracted, ai_confidence_score, is_current, uploaded_by, uploaded_at, notes
    )
    SELECT
      v.org_id, v.property_id, v.document_type, v.issue_date, v.expiry_date,
      v.certificate_number, v.issuer_name, v.file_url, v.file_name, v.status_calc,
      true, v.ai_confidence_score, false, v.uploaded_by, v.created_at,
      'Backfilled from Document Vault (historical)'
    FROM _vault_candidates v
    WHERE v.rn > 1
    RETURNING id
  )
  SELECT count(*) INTO inserted_history FROM ins2;

  RAISE NOTICE 'Vault backfill: % promotions, % current rows, % historical rows',
    promoted_count, inserted_current, inserted_history;
END $$;
