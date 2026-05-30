CREATE OR REPLACE FUNCTION public.prevent_platform_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_role text;
BEGIN
  -- Service role (edge functions, server-side admin code) is always allowed.
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT p.platform_role INTO caller_role
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  IF NEW.platform_role IS DISTINCT FROM OLD.platform_role
     AND COALESCE(caller_role, '') <> 'super_admin' THEN
    RAISE EXCEPTION 'platform_role can only be changed by a super_admin or service_role';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     AND COALESCE(caller_role, '') <> 'super_admin' THEN
    RAISE EXCEPTION 'role can only be changed by a super_admin or service_role';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_platform_role ON public.profiles;
CREATE TRIGGER guard_platform_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_platform_role_change();