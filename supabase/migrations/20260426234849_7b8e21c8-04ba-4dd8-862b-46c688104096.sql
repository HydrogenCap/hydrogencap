
UPDATE public.documents d
SET
  extraction_status = 'review_needed',
  ai_suggested_doc_type = e.doc_type,
  ai_doc_type_confidence = e.doc_type_confidence,
  ai_suggested_property_id = CASE
    WHEN (e.extracted_fields->>'property_id_match') ~ '^[0-9a-fA-F-]{36}$'
    THEN (e.extracted_fields->>'property_id_match')::uuid
    ELSE NULL
  END,
  extracted_address_text = e.extracted_fields->>'address',
  extracted_issue_date = CASE
    WHEN (e.extracted_fields->>'issue_date') ~ '^\d{4}-\d{2}-\d{2}$'
    THEN (e.extracted_fields->>'issue_date')::date
    ELSE NULL
  END,
  extracted_reference_number = e.extracted_fields->>'reference_number',
  expiry_date = CASE
    WHEN (e.extracted_fields->>'expiry_date') ~ '^\d{4}-\d{2}-\d{2}$'
    THEN (e.extracted_fields->>'expiry_date')::date
    ELSE NULL
  END,
  ai_model = 'google/gemini-2.5-flash'
FROM (
  SELECT DISTINCT ON (document_id) document_id, doc_type, doc_type_confidence, extracted_fields
  FROM public.document_extractions
  ORDER BY document_id, created_at DESC
) e
WHERE d.id = e.document_id
  AND d.id IN (
    '53297147-3bd9-4d3e-946b-f067a6d3cf3c',
    'd982d87d-d086-4fc2-ba11-bda6f5cd1408'
  );
