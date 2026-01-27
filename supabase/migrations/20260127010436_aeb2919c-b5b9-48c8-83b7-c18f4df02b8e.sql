-- Fix the security definer view issue by dropping and recreating with SECURITY INVOKER
DROP VIEW IF EXISTS public.company_secrets_masked;

-- Recreate view with explicit SECURITY INVOKER (uses querying user's permissions)
CREATE VIEW public.company_secrets_masked 
WITH (security_invoker = true)
AS
SELECT 
  cs.company_id,
  CASE WHEN cs.auth_code_last4 IS NOT NULL THEN '••••' || cs.auth_code_last4 ELSE NULL END as auth_code_masked,
  CASE WHEN cs.utr_last4 IS NOT NULL THEN '••••••' || cs.utr_last4 ELSE NULL END as utr_masked,
  cs.auth_code_last4,
  cs.utr_last4,
  cs.updated_at
FROM public.company_secrets cs;

-- Grant access to the view
GRANT SELECT ON public.company_secrets_masked TO authenticated;