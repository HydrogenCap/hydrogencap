
-- Fix SECURITY DEFINER view issue by setting security_invoker
ALTER VIEW public.tenancy_compliance_check_v2 SET (security_invoker = on);
