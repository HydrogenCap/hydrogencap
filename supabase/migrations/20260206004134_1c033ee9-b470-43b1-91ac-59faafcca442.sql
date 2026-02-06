-- Fix the generate_job_inbox_email function to use built-in functions
CREATE OR REPLACE FUNCTION public.generate_job_inbox_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token TEXT;
BEGIN
  -- Generate unique token using gen_random_uuid() which is built-in
  v_token := replace(substring(gen_random_uuid()::text, 1, 16), '-', '');
  
  NEW.inbox_email_token := v_token;
  NEW.inbox_email := 'job-' || v_token || '@inbox.hydrogencap.app';
  
  RETURN NEW;
END;
$function$;