-- Fix public invite/share flows by moving validation and writes into security-definer RPCs

-- Shared document links should no longer be read or mutated directly by anonymous clients.
DROP POLICY IF EXISTS "Anyone can view share links by token" ON public.document_share_links;
DROP POLICY IF EXISTS "Anon can increment view count on valid share links" ON public.document_share_links;
DROP POLICY IF EXISTS "Anyone can update view count on active share links" ON public.document_share_links;

-- Shareholder invite acceptance should go through a single RPC rather than client-side table writes.
DROP POLICY IF EXISTS "Users can accept their own invite" ON public.shareholder_invites;
DROP POLICY IF EXISTS "Users can create their own shareholder access" ON public.shareholder_access;

CREATE OR REPLACE FUNCTION public.get_shareholder_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.shareholder_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite
  FROM public.shareholder_invites
  WHERE token = p_token;

  IF NOT FOUND OR v_invite.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'accepted');
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'status', 'valid',
    'email', v_invite.email,
    'name', v_invite.name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_shareholder_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.shareholder_invites%ROWTYPE;
  v_user_id UUID;
  v_user_email TEXT;
  v_access_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  SELECT * INTO v_invite
  FROM public.shareholder_invites
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND OR v_invite.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Invite not found');
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'This invite has already been accepted');
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'This invite has expired');
  END IF;

  IF v_user_email IS NULL OR lower(v_user_email) <> lower(v_invite.email) THEN
    RETURN jsonb_build_object('error', 'This invite was sent to a different email address');
  END IF;

  SELECT id INTO v_access_id
  FROM public.shareholder_access
  WHERE user_id = v_user_id
    AND org_id = v_invite.org_id
    AND revoked_at IS NULL;

  IF v_access_id IS NULL THEN
    INSERT INTO public.shareholder_access (
      org_id,
      user_id,
      invite_id,
      access_level,
      can_view_financials,
      can_view_compliance,
      can_view_documents
    )
    VALUES (
      v_invite.org_id,
      v_user_id,
      v_invite.id,
      'read_only',
      true,
      true,
      true
    )
    RETURNING id INTO v_access_id;
  END IF;

  UPDATE public.shareholder_invites
  SET accepted_at = now()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'access_id', v_access_id,
    'org_id', v_invite.org_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_portal_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.tenant_portal_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite
  FROM public.tenant_portal_invites
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'accepted');
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'status', 'valid',
    'email', v_invite.email
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_tenant_portal_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.tenant_portal_invites%ROWTYPE;
  v_user_id UUID;
  v_user_email TEXT;
  v_access_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  SELECT * INTO v_invite
  FROM public.tenant_portal_invites
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invite not found');
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'This invite has already been accepted');
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'This invite has expired');
  END IF;

  IF v_user_email IS NULL OR lower(v_user_email) <> lower(v_invite.email) THEN
    RETURN jsonb_build_object('error', 'This invite was sent to a different email address');
  END IF;

  SELECT id INTO v_access_id
  FROM public.tenant_portal_access
  WHERE user_id = v_user_id
    AND tenancy_id = v_invite.tenancy_id
    AND revoked_at IS NULL;

  IF v_access_id IS NULL THEN
    INSERT INTO public.tenant_portal_access (
      org_id,
      tenant_id,
      tenancy_id,
      user_id,
      invite_id
    )
    VALUES (
      v_invite.org_id,
      v_invite.tenant_id,
      v_invite.tenancy_id,
      v_user_id,
      v_invite.id
    )
    RETURNING id INTO v_access_id;
  END IF;

  UPDATE public.tenant_portal_invites
  SET accepted_at = now()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'access_id', v_access_id,
    'org_id', v_invite.org_id,
    'tenancy_id', v_invite.tenancy_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_document_share_link(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.document_share_links%ROWTYPE;
  v_file_url TEXT;
  v_file_name TEXT;
  v_bucket_id TEXT;
BEGIN
  SELECT * INTO v_link
  FROM public.document_share_links
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Share link not found or has been revoked');
  END IF;

  IF v_link.is_active IS NOT TRUE THEN
    RETURN jsonb_build_object('error', 'This share link has been deactivated');
  END IF;

  IF v_link.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'This share link has expired');
  END IF;

  IF v_link.document_id IS NOT NULL THEN
    SELECT d.file_url, d.original_file_name
      INTO v_file_url, v_file_name
    FROM public.documents d
    WHERE d.id = v_link.document_id;
    v_bucket_id := 'documents';
  ELSE
    SELECT cd.file_url, cd.original_file_name
      INTO v_file_url, v_file_name
    FROM public.compliance_documents cd
    WHERE cd.id = v_link.compliance_document_id;
    v_bucket_id := 'compliance';
  END IF;

  IF v_file_url IS NULL THEN
    RETURN jsonb_build_object('error', 'Document not found');
  END IF;

  IF v_link.max_views IS NOT NULL AND v_link.view_count >= v_link.max_views THEN
    RETURN jsonb_build_object('error', 'This share link has reached its maximum view limit');
  END IF;

  UPDATE public.document_share_links
  SET
    view_count = view_count + 1,
    last_viewed_at = now()
  WHERE id = v_link.id;

  RETURN jsonb_build_object(
    'success', true,
    'file_url', v_file_url,
    'file_name', COALESCE(v_file_name, 'Document'),
    'expires_at', v_link.expires_at,
    'bucket_id', v_bucket_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shareholder_invite(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_shareholder_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_portal_invite(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_tenant_portal_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_document_share_link(TEXT) TO anon, authenticated;
