
CREATE OR REPLACE FUNCTION public.auto_generate_rent_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_months INTEGER;
BEGIN
  IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status != 'active') THEN
    -- Calculate months from start to end, default 12 if no end date
    IF NEW.end_date IS NOT NULL THEN
      v_months := GREATEST(
        1,
        (EXTRACT(YEAR FROM NEW.end_date::date) - EXTRACT(YEAR FROM NEW.start_date::date)) * 12
        + (EXTRACT(MONTH FROM NEW.end_date::date) - EXTRACT(MONTH FROM NEW.start_date::date))
        + 1
      );
    ELSE
      v_months := 12;
    END IF;
    
    PERFORM public.generate_rent_schedule(NEW.id, v_months);
  END IF;
  
  RETURN NEW;
END;
$function$;
