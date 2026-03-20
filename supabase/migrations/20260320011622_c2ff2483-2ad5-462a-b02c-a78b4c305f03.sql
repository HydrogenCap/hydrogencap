-- P0-3: Fix accept_team_invite — validate accepting user's email matches invite
-- P0-4: Fix rate_limits INSERT/DELETE policies

-- ====== P0-3: Replace accept_team_invite ======

CREATE OR REPLACE FUNCTION public.accept_team_invite(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
  v_user_email TEXT;
  v_existing_membership UUID;
  v_new_membership UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Get the user's email for verification
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_invite
  FROM public.team_invites
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invite not found');
  END IF;

  IF v_invite.revoked_at IS NOT NULL THEN
    RETURN json_build_object('error', 'This invite has been revoked');
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN json_build_object('error', 'This invite has already been accepted');
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN json_build_object('error', 'This invite has expired');
  END IF;

  -- Verify accepting user's email matches the invite
  IF lower(v_invite.email) != lower(v_user_email) THEN
    RETURN json_build_object('error', 'This invite was sent to a different email address');
  END IF;

  SELECT id INTO v_existing_membership
  FROM public.memberships
  WHERE user_id = v_user_id AND org_id = v_invite.org_id;

  IF v_existing_membership IS NOT NULL THEN
    -- Upgrade role if invite grants a higher role
    UPDATE public.memberships
    SET role = (
      CASE
        WHEN v_invite.role = 'admin' AND role = 'viewer' THEN 'admin'::app_role
        ELSE role
      END
    )
    WHERE id = v_existing_membership;

    UPDATE public.team_invites
    SET accepted_at = now(), accepted_by = v_user_id
    WHERE id = v_invite.id;

    RETURN json_build_object('success', true, 'message', 'Membership updated');
  END IF;

  INSERT INTO public.memberships (user_id, org_id, role)
  VALUES (v_user_id, v_invite.org_id, v_invite.role)
  RETURNING id INTO v_new_membership;

  UPDATE public.team_invites
  SET accepted_at = now(), accepted_by = v_user_id
  WHERE id = v_invite.id;

  RETURN json_build_object(
    'success', true,
    'membership_id', v_new_membership,
    'org_id', v_invite.org_id,
    'role', v_invite.role
  );
END;
$$;

-- ====== P0-4: Fix rate_limits RLS policies ======

DROP POLICY IF EXISTS "Users can insert own rate limit entries" ON public.rate_limits;
DROP POLICY IF EXISTS "Service role can delete old rate limits" ON public.rate_limits;
DROP POLICY IF EXISTS "Service role can read rate limits" ON public.rate_limits;

-- Users can only insert their own records
CREATE POLICY "Users can insert own rate limit entries"
  ON public.rate_limits FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Only service role can read (edge functions use service key)
CREATE POLICY "Service role can read rate limits"
  ON public.rate_limits FOR SELECT
  USING (current_setting('role') = 'service_role');

-- Only service role can delete (cleanup function)
CREATE POLICY "Service role can delete old rate limits"
  ON public.rate_limits FOR DELETE
  USING (current_setting('role') = 'service_role');

-- ====== P0-8: Fix scheduled_email_runs cross-org exposure ======

-- Check if org_id column exists, add if not
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'scheduled_email_runs' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE public.scheduled_email_runs ADD COLUMN org_id UUID REFERENCES public.organizations(id);
  END IF;
END $$;

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Allow select for authenticated users" ON public.scheduled_email_runs;
DROP POLICY IF EXISTS "Anyone can read scheduled_email_runs" ON public.scheduled_email_runs;

-- Create org-scoped SELECT policy
CREATE POLICY "Users can read own org email runs"
  ON public.scheduled_email_runs FOR SELECT
  USING (
    org_id IN (SELECT m.org_id FROM public.memberships m WHERE m.user_id = auth.uid())
  );

-- ====== P0-9: Financial snapshot locking trigger ======

CREATE OR REPLACE FUNCTION public.prevent_locked_snapshot_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Allow unlock operation (is_locked going from true to false)
  IF OLD.is_locked = true AND NOT (NEW.is_locked = false) THEN
    RAISE EXCEPTION 'Cannot modify a locked financial snapshot. Unlock it first.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_snapshot_lock ON public.financial_snapshots;
CREATE TRIGGER enforce_snapshot_lock
BEFORE UPDATE ON public.financial_snapshots
FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_snapshot_update();