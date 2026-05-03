-- Backfill: re-point any documents.ai_suggested_property_id (and property_id where it matches the suggestion)
-- that still references a V1 properties row to its V2 properties_v2 sibling. Idempotent.
DO $$
DECLARE
  v_drift_count int;
  v_unmatched int;
  v_updated int;
BEGIN
  -- Identify documents whose ai_suggested_property_id references a V1 row that does NOT also exist in V2
  CREATE TEMP TABLE tmp_drift ON COMMIT DROP AS
  SELECT
    d.id AS document_id,
    d.org_id,
    d.ai_suggested_property_id AS v1_id,
    p.address_line,
    p.postcode,
    (
      SELECT p2.id FROM public.properties_v2 p2
      WHERE p2.org_id = d.org_id
        AND lower(regexp_replace(coalesce(p2.postcode,''), '\s+', '', 'g'))
            = lower(regexp_replace(coalesce(p.postcode,''), '\s+', '', 'g'))
        AND lower(coalesce(p2.address_line_1,'')) = lower(coalesce(p.address_line,''))
      LIMIT 1
    ) AS v2_sibling_id
  FROM public.documents d
  JOIN public.properties p ON p.id = d.ai_suggested_property_id
  WHERE d.ai_suggested_property_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.properties_v2 p2 WHERE p2.id = d.ai_suggested_property_id);

  SELECT count(*) INTO v_drift_count FROM tmp_drift;
  SELECT count(*) INTO v_unmatched FROM tmp_drift WHERE v2_sibling_id IS NULL;

  IF v_unmatched > 0 THEN
    RAISE EXCEPTION 'Backfill aborted: % V1-suggested document(s) have no V2 sibling (postcode + address_line_1 match)', v_unmatched;
  END IF;

  UPDATE public.documents d
  SET ai_suggested_property_id = t.v2_sibling_id,
      property_id = CASE WHEN d.property_id = t.v1_id OR d.property_id IS NULL THEN t.v2_sibling_id ELSE d.property_id END
  FROM tmp_drift t
  WHERE d.id = t.document_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RAISE NOTICE 'V1->V2 ai_suggested_property_id backfill: drift=%, updated=%', v_drift_count, v_updated;
END $$;