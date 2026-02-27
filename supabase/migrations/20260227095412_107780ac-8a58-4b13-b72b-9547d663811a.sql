
-- Prevent overlapping ownership_links for the same subject + owner + type
-- Two active records overlap if their date ranges intersect
CREATE OR REPLACE FUNCTION public.validate_ownership_no_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_conflict_count INTEGER;
BEGIN
  -- Only validate active (non-ended) or date-bounded records
  SELECT COUNT(*)
  INTO v_conflict_count
  FROM public.ownership_links ol
  WHERE ol.subject_type = NEW.subject_type
    AND ol.subject_id = NEW.subject_id
    AND ol.owner_party_id = NEW.owner_party_id
    AND ol.ownership_type = NEW.ownership_type
    AND ol.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
    -- Date range overlap check:
    -- Two ranges [A_from, A_to] and [B_from, B_to] overlap when:
    -- A_from < B_to (or B_to is null) AND B_from < A_to (or A_to is null)
    AND (
      ol.effective_to IS NULL
      OR ol.effective_to > COALESCE(NEW.effective_from, '1900-01-01'::date)
    )
    AND (
      NEW.effective_to IS NULL
      OR NEW.effective_to > COALESCE(ol.effective_from, '1900-01-01'::date)
    );

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Overlapping ownership period detected for subject %:% owner % type %. Found % conflicting record(s).',
      NEW.subject_type, NEW.subject_id, NEW.owner_party_id, NEW.ownership_type, v_conflict_count;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_ownership_no_overlap
BEFORE INSERT OR UPDATE ON public.ownership_links
FOR EACH ROW
EXECUTE FUNCTION public.validate_ownership_no_overlap();
