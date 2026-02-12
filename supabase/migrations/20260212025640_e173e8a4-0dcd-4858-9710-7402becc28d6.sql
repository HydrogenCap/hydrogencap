
-- ============================================
-- TEAM INVITES TABLE
-- ============================================

CREATE TABLE public.team_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role app_role NOT NULL DEFAULT 'viewer',
  invited_by UUID NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT team_invites_email_org_unique UNIQUE (email, org_id)
);

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Org members can view invites for their org
CREATE POLICY "Org members can view team invites"
ON public.team_invites
FOR SELECT
USING (public.user_has_org_access(org_id));

-- Org members can create invites
CREATE POLICY "Org members can create team invites"
ON public.team_invites
FOR INSERT
WITH CHECK (public.user_has_org_access(org_id));

-- Org members can update invites (revoke, resend)
CREATE POLICY "Org members can update team invites"
ON public.team_invites
FOR UPDATE
USING (public.user_has_org_access(org_id));

-- Org members can delete invites
CREATE POLICY "Org members can delete team invites"
ON public.team_invites
FOR DELETE
USING (public.user_has_org_access(org_id));

CREATE INDEX idx_team_invites_org ON public.team_invites(org_id);
CREATE INDEX idx_team_invites_token ON public.team_invites(token);
CREATE INDEX idx_team_invites_email ON public.team_invites(email);

-- ============================================
-- EXPAND MEMBERSHIPS RLS
-- ============================================

DROP POLICY IF EXISTS "Users can view own memberships" ON public.memberships;
DROP POLICY IF EXISTS "Users can insert own memberships" ON public.memberships;

-- Any org member can view all memberships in their org
CREATE POLICY "Org members can view org memberships"
ON public.memberships
FOR SELECT
USING (public.user_has_org_access(org_id));

-- Users can insert their own membership (for invite acceptance)
CREATE POLICY "Users can insert own memberships"
ON public.memberships
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Org members can update memberships in their org (role changes)
CREATE POLICY "Org members can update org memberships"
ON public.memberships
FOR UPDATE
USING (public.user_has_org_access(org_id));

-- Org members can delete memberships in their org (removal)
CREATE POLICY "Org members can delete org memberships"
ON public.memberships
FOR DELETE
USING (public.user_has_org_access(org_id));

-- ============================================
-- EXPAND PROFILES RLS
-- ============================================

CREATE POLICY "Org members can view teammate profiles"
ON public.profiles
FOR SELECT
USING (
  user_id IN (
    SELECT m.user_id FROM public.memberships m
    WHERE m.org_id IN (
      SELECT m2.org_id FROM public.memberships m2
      WHERE m2.user_id = auth.uid()
    )
  )
);

-- ============================================
-- ACCEPT TEAM INVITE FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.accept_team_invite(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
  v_existing_membership UUID;
  v_new_membership UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

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

  SELECT id INTO v_existing_membership
  FROM public.memberships
  WHERE user_id = v_user_id AND org_id = v_invite.org_id;

  IF v_existing_membership IS NOT NULL THEN
    UPDATE public.team_invites
    SET accepted_at = now(), accepted_by = v_user_id
    WHERE id = v_invite.id;

    RETURN json_build_object('success', true, 'message', 'Already a member of this organisation');
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
