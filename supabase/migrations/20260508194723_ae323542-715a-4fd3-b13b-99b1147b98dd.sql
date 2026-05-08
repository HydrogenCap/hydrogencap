DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.documents
  WHERE id IN (
    'fae24951-9e46-4066-9b34-0adb5627df67',
    '2a274297-c909-48ac-ad94-cd73f3cf0000',
    'd982d87d-d086-4fc2-ba11-bda6f5cd1408',
    '8449adcd-6a1b-4937-abd5-9668f95dc86e',
    'ac7a6017-5fc1-4cb6-a285-ea7422ccd92f'
  )
    AND property_id IS NULL
    AND ai_suggested_property_id IS NOT NULL;

  IF v_count NOT BETWEEN 0 AND 5 THEN
    RAISE EXCEPTION 'Preflight failed: expected 0..5 rows to update, got %', v_count;
  END IF;

  UPDATE public.documents
  SET property_id   = ai_suggested_property_id,
      doc_type      = COALESCE(ai_suggested_doc_type, doc_type),
      review_status = 'accepted',
      updated_at    = now()
  WHERE id IN (
    'fae24951-9e46-4066-9b34-0adb5627df67',
    '2a274297-c909-48ac-ad94-cd73f3cf0000',
    'd982d87d-d086-4fc2-ba11-bda6f5cd1408',
    '8449adcd-6a1b-4937-abd5-9668f95dc86e',
    'ac7a6017-5fc1-4cb6-a285-ea7422ccd92f'
  )
    AND property_id IS NULL
    AND ai_suggested_property_id IS NOT NULL;
END $$;