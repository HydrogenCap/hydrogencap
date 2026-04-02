-- Multi-org support: extend roles, org invites table, permission helper
-- Adds 'member' and 'accountant' to app_role enum
-- Creates org_invites table for role-based invitations
-- Adds user_has_permission() function for fine-grained access control

-- ============================================
-- EXTEND app_role ENUM
-- ============================================

-- Add new enum values (idempotent via IF NOT EXISTS-style check)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'member' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'member' AFTER 'admin';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'accountant' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'accountant' AFTER 'member';
  END IF;
END $$;

-- ============================================
-- ORG INVITES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.org_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage org invites" ON public.org_invites
  FOR ALL
  USING (
    org_id IN (
      SELECT m.org_id FROM public.memberships m
      WHERE m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_org_invites_org ON public.org_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON public.org_invites(token);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON public.org_invites(email);

-- ============================================
-- PERMISSION HELPER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.user_has_permission(p_org_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.memberships
  WHERE org_id = p_org_id AND user_id = auth.uid();

  IF v_role IS NULL THEN RETURN FALSE; END IF;

  RETURN CASE
    WHEN v_role = 'owner' THEN TRUE
    WHEN v_role = 'admin' THEN p_permission != 'delete_org'
    WHEN v_role = 'member' THEN p_permission IN ('read', 'write', 'create')
    WHEN v_role = 'accountant' THEN p_permission IN ('read', 'read_financials', 'write_financials')
    WHEN v_role = 'viewer' THEN p_permission = 'read'
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
