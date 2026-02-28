-- =============================================
-- V4: RLS Hardening — Fix weakly-scoped SELECT policies
-- =============================================

-- ─── shareholder_invites ───
-- The "Users can view invites by token" policy allows ANY authenticated user 
-- to read ALL invites (containing PII like emails). 
-- Fix: scope to invites where the user's email matches OR they're an org admin.
DROP POLICY IF EXISTS "Users can view invites by token" ON public.shareholder_invites;

CREATE POLICY "Users can view their own invites"
  ON public.shareholder_invites FOR SELECT
  USING (
    -- User can see invites addressed to their email
    email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
    OR
    -- Or they are an admin/owner of the org
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.org_id = shareholder_invites.org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

-- ─── ai_extraction_templates ───
-- Global lookup table with no org_id — data is not org-specific.
-- Policy is acceptable. Adding comment for documentation.
COMMENT ON POLICY "Authenticated read" ON public.ai_extraction_templates 
  IS 'Global lookup table — no org scoping needed. All authenticated users may read extraction templates.';

-- ─── financial_categories ───
-- Global lookup table with no org_id — data is not org-specific.
-- Policy is acceptable. Adding comment for documentation.
COMMENT ON POLICY "Authenticated users can read financial_categories" ON public.financial_categories 
  IS 'Global lookup table — no org scoping needed. All authenticated users may read financial categories.';