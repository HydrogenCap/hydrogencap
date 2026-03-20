-- P0-1: Fix memberships RLS — restrict UPDATE/DELETE to admin/owner only

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Org members can update org memberships" ON public.memberships;
DROP POLICY IF EXISTS "Org members can delete org memberships" ON public.memberships;

-- Only admins/owners can update membership rows in their org
CREATE POLICY "Admins can update org memberships"
ON public.memberships FOR UPDATE
USING (
  auth.uid() IN (
    SELECT user_id FROM public.memberships m2
    WHERE m2.org_id = memberships.org_id
    AND m2.role IN ('admin', 'owner')
  )
);

-- Only admins/owners can delete membership rows, and cannot delete themselves
CREATE POLICY "Admins can delete org memberships"
ON public.memberships FOR DELETE
USING (
  auth.uid() IN (
    SELECT user_id FROM public.memberships m2
    WHERE m2.org_id = memberships.org_id
    AND m2.role IN ('admin', 'owner')
  )
  AND memberships.user_id != auth.uid()
);