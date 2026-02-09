
-- Function to cancel auto-created jobs whose compliance items have been renewed
-- (i.e. the linked compliance item now has a valid expiry_date in the future)
CREATE OR REPLACE FUNCTION public.cancel_renewed_compliance_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cancelled_count integer;
BEGIN
  UPDATE contractor_jobs cj
  SET 
    status = 'cancelled',
    internal_notes = COALESCE(internal_notes || E'\n', '') || 'Auto-cancelled: compliance certificate was renewed.',
    updated_at = now()
  FROM compliance_items ci
  WHERE cj.compliance_item_id = ci.id
    AND cj.source = 'auto_compliance'
    AND cj.status NOT IN ('completed', 'verified', 'cancelled')
    AND ci.expiry_date IS NOT NULL
    AND ci.expiry_date > (now() + interval '60 days');

  GET DIAGNOSTICS cancelled_count = ROW_COUNT;
  RETURN cancelled_count;
END;
$$;
