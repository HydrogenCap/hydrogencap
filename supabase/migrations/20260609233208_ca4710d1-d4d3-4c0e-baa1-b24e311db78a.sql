
-- 1. Fix demo_requests SELECT policy: profiles links via user_id, not id
DROP POLICY IF EXISTS "Platform admins can view demo requests" ON public.demo_requests;
CREATE POLICY "Platform admins can view demo requests"
ON public.demo_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.platform_role = ANY (ARRAY['platform_admin'::text, 'super_admin'::text])
  )
);

-- 2. Harden investor report storage access: enforce exact org-id path prefix
CREATE OR REPLACE FUNCTION public.user_can_access_investor_report(file_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.org_id::text = split_part(file_name, '/', 1)
  )
$function$;
