-- ============================================================
-- CRITICAL: close cross-org privilege escalation via memberships INSERT
--
-- "Users can insert own memberships" only checks auth.uid() = user_id,
-- allowing ANY authenticated user to INSERT a row
--   { user_id: self, org_id: <victim_org>, role: 'owner' }
-- and silently take over another organization.
--
-- "Owners and admins can insert memberships" carries the same fallback
-- via `OR (auth.uid() = user_id)`.
--
-- The accept_team_invite RPC is SECURITY DEFINER and bypasses RLS, so the
-- only legitimate user-facing path that still needs to self-insert is the
-- initial "create my own organization" bootstrap. We replace that path
-- with a SECURITY DEFINER RPC and tighten the policies.
-- ============================================================

DROP POLICY IF EXISTS "Users can insert own memberships" ON public.memberships;
DROP POLICY IF EXISTS "Owners and admins can insert memberships" ON public.memberships;

CREATE POLICY "Owners and admins can insert memberships"
ON public.memberships
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.org_id = memberships.org_id
      AND m.user_id = auth.uid()
      AND m.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role])
  )
);

-- Bootstrap RPC: atomically create an organization and make the caller its owner.
CREATE OR REPLACE FUNCTION public.create_organization(p_name text)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org public.organizations;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;

  INSERT INTO public.organizations (name)
  VALUES (btrim(p_name))
  RETURNING * INTO v_org;

  INSERT INTO public.memberships (user_id, org_id, role)
  VALUES (v_user_id, v_org.id, 'owner');

  RETURN v_org;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_organization(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization(text) TO authenticated;

-- ============================================================
-- Notifications: stop unrestricted INSERT
--
-- Previously any authenticated user could insert a notification targeting
-- any other user. Edge functions that need to broadcast use the service
-- role and bypass RLS, so we lock client-side inserts to self only.
-- ============================================================
DROP POLICY IF EXISTS "Service can insert system notifications" ON public.notifications;

-- ============================================================
-- Scheduled email runs: lock client-side writes
--
-- Only the cron edge functions (service role) should be writing here.
-- ============================================================
DROP POLICY IF EXISTS "Service can insert email runs" ON public.scheduled_email_runs;
DROP POLICY IF EXISTS "Service can update email runs" ON public.scheduled_email_runs;
