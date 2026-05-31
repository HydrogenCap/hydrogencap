-- ============================================================
-- Idempotent compliance backfill (one-off)
-- ============================================================

-- (1) File orphan FRA for property f4938519 (25 Arle Gardens)
--     Document 2a274297-c909-48ac-ad94-cd73f3cf0000 is accepted in
--     the inbox but never landed in compliance_documents_v2.
DO $$
DECLARE
  v_doc_id uuid := '2a274297-c909-48ac-ad94-cd73f3cf0000';
  v_property uuid := 'f4938519-8091-4644-ac3b-a021e6d67b8d';
  v_doc_type text := 'fire_risk_assessment';
  v_org uuid;
  v_issue date;
  v_expiry date;
  v_file_url text;
  v_file_name text;
BEGIN
  SELECT org_id,
         COALESCE(extracted_issue_date::date, NULL),
         COALESCE(expiry_date::date, NULL),
         file_url,
         COALESCE(final_file_name, original_file_name)
    INTO v_org, v_issue, v_expiry, v_file_url, v_file_name
  FROM public.documents
  WHERE id = v_doc_id;

  IF v_org IS NULL THEN
    RAISE NOTICE 'FRA backfill: source document % not found, skipping', v_doc_id;
  ELSIF EXISTS (
    SELECT 1 FROM public.compliance_documents_v2
    WHERE property_id = v_property
      AND document_type = v_doc_type
      AND is_current = true
  ) THEN
    RAISE NOTICE 'FRA backfill: current FRA already exists for %, skipping', v_property;
  ELSE
    INSERT INTO public.compliance_documents_v2 (
      org_id, property_id, document_type,
      issue_date, expiry_date,
      file_url, file_name,
      status, ai_extracted, is_current, notes
    ) VALUES (
      v_org, v_property, v_doc_type,
      COALESCE(v_issue, CURRENT_DATE),
      v_expiry,
      v_file_url, v_file_name,
      CASE
        WHEN v_expiry IS NULL THEN 'valid'
        WHEN v_expiry < CURRENT_DATE THEN 'expired'
        WHEN v_expiry < CURRENT_DATE + INTERVAL '30 days' THEN 'critical'
        WHEN v_expiry < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_soon'
        ELSE 'valid'
      END,
      true, true,
      'Backfilled from inbox document ' || v_doc_id::text
    );
    RAISE NOTICE 'FRA backfill: inserted compliance_documents_v2 row for %', v_property;
  END IF;
END
$$;

-- (2) Re-type legacy Fire Suppression System certificate from 'other'
--     to its closest V2 category. A newer fire_alarm_cert is already
--     is_current at this property, so mark the legacy one historic.
DO $$
DECLARE
  v_doc_id uuid := '3ce6ba41-f3e2-49f1-b08b-e669bbd7ed68';
  v_target_type text := 'fire_alarm_cert';
  v_property uuid;
  v_current_exists boolean;
BEGIN
  SELECT property_id INTO v_property
  FROM public.compliance_documents_v2
  WHERE id = v_doc_id AND document_type = 'other';

  IF v_property IS NULL THEN
    RAISE NOTICE 'Fire suppression re-type: doc % already re-typed or not found, skipping', v_doc_id;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.compliance_documents_v2
      WHERE property_id = v_property
        AND document_type = v_target_type
        AND is_current = true
        AND id <> v_doc_id
    ) INTO v_current_exists;

    UPDATE public.compliance_documents_v2
       SET document_type = v_target_type,
           is_current = CASE WHEN v_current_exists THEN false ELSE is_current END,
           notes = COALESCE(notes || E'\n', '') ||
                   'Re-typed from "other" to fire_alarm_cert by backfill on ' || now()::text
     WHERE id = v_doc_id;
    RAISE NOTICE 'Fire suppression re-type: updated doc % (kept_historic=%)', v_doc_id, v_current_exists;
  END IF;
END
$$;
