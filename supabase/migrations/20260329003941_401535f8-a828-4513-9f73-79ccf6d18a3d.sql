-- Fix 3 (corrected): Scope shareholder_invites SELECT to caller's own orgs or email match
DROP POLICY IF EXISTS "Users can view invites by token" ON public.shareholder_invites;
DROP POLICY IF EXISTS "Anyone can view shareholder invites" ON public.shareholder_invites;
DROP POLICY IF EXISTS "Users can view invites for their org or by email" ON public.shareholder_invites;

CREATE POLICY "Users can view invites for their org or by email"
  ON public.shareholder_invites
  FOR SELECT
  USING (
    org_id IN (
      SELECT m.org_id FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
    OR
    email = (
      SELECT p.email FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );