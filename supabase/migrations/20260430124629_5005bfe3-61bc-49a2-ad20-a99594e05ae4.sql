-- Fix company_secrets RLS to reference V2 legal_entities instead of V1 companies.
-- Idempotent: drops by exact name (discovered via pg_policies) then recreates.

DROP POLICY IF EXISTS "Admin/Finance can view company secrets"   ON public.company_secrets;
DROP POLICY IF EXISTS "Admin/Finance can insert company secrets" ON public.company_secrets;
DROP POLICY IF EXISTS "Admin/Finance can update company secrets" ON public.company_secrets;
DROP POLICY IF EXISTS "Admin/Finance can delete company secrets" ON public.company_secrets;

CREATE POLICY "Admin/Finance can view company secrets"
ON public.company_secrets
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.legal_entities le
    JOIN public.memberships m ON m.org_id = le.org_id
    WHERE le.id = company_secrets.company_id
      AND m.user_id = auth.uid()
      AND m.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role])
  )
);

CREATE POLICY "Admin/Finance can insert company secrets"
ON public.company_secrets
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.legal_entities le
    JOIN public.memberships m ON m.org_id = le.org_id
    WHERE le.id = company_secrets.company_id
      AND m.user_id = auth.uid()
      AND m.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role])
  )
);

CREATE POLICY "Admin/Finance can update company secrets"
ON public.company_secrets
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.legal_entities le
    JOIN public.memberships m ON m.org_id = le.org_id
    WHERE le.id = company_secrets.company_id
      AND m.user_id = auth.uid()
      AND m.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.legal_entities le
    JOIN public.memberships m ON m.org_id = le.org_id
    WHERE le.id = company_secrets.company_id
      AND m.user_id = auth.uid()
      AND m.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role])
  )
);

CREATE POLICY "Admin/Finance can delete company secrets"
ON public.company_secrets
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.legal_entities le
    JOIN public.memberships m ON m.org_id = le.org_id
    WHERE le.id = company_secrets.company_id
      AND m.user_id = auth.uid()
      AND m.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role])
  )
);