
-- Create a function to update overdue rent statuses (avoids enum type mismatch from JS client)
CREATE OR REPLACE FUNCTION public.update_rent_schedule_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE rent_schedule
  SET status = 'overdue'::rent_status, updated_at = now()
  WHERE status = 'upcoming'::rent_status
  AND due_date < CURRENT_DATE;

  UPDATE rent_schedule
  SET status = 'due'::rent_status, updated_at = now()
  WHERE status = 'upcoming'::rent_status
  AND due_date = CURRENT_DATE;
END;
$function$;
