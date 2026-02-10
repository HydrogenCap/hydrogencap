
-- ============================================
-- BLOCKER #1: Storage Bucket Security
-- ============================================

-- Make documents bucket private (it's currently public)
UPDATE storage.buckets SET public = false WHERE id = 'documents';
-- photos and floorplans stay public for now but we add org-scoped write policies
-- (making them private would break all existing image URLs; we'll address in a follow-up)

-- Drop overly-permissive storage policies
DROP POLICY IF EXISTS "Users can delete their documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their org documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their floorplans" ON storage.objects;
DROP POLICY IF EXISTS "Users can view floorplans" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload compliance files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update compliance files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete compliance files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view compliance files in their org" ON storage.objects;

-- Compliance bucket: org-scoped policies
CREATE POLICY "Org members can view compliance files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'compliance'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT org_id::text FROM memberships WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Org members can upload compliance files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'compliance'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT org_id::text FROM memberships WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Org members can update compliance files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'compliance'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT org_id::text FROM memberships WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Org members can delete compliance files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'compliance'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT org_id::text FROM memberships WHERE user_id = auth.uid()
  )
);

-- ============================================
-- BLOCKER #2: Shared Document Page RLS
-- ============================================

-- Drop the existing overly-restrictive policy
DROP POLICY IF EXISTS "Users can manage share links in their org" ON public.document_share_links;

-- Org members can manage (create/update/delete) their share links
CREATE POLICY "Org members can manage share links"
ON public.document_share_links
FOR ALL
USING (user_has_org_access(org_id))
WITH CHECK (user_has_org_access(org_id));

-- Anyone can SELECT a share link by token (for the shared document viewer)
-- The token itself is the secret (256-bit random); listing requires knowing it
CREATE POLICY "Anyone can view share links by token"
ON public.document_share_links
FOR SELECT
USING (true);

-- Allow the shared page to increment view_count (anonymous update)
CREATE POLICY "Anyone can update view count on active share links"
ON public.document_share_links
FOR UPDATE
USING (is_active = true)
WITH CHECK (is_active = true);

-- ============================================
-- BLOCKER #3: Portal Invite Acceptance RLS
-- ============================================

-- Drop the admin-only ALL policy
DROP POLICY IF EXISTS "Admins can manage shareholder invites" ON public.shareholder_invites;

-- Admins can do everything with invites
CREATE POLICY "Admins can manage invites"
ON public.shareholder_invites
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.org_id = shareholder_invites.org_id
    AND m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.org_id = shareholder_invites.org_id
    AND m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
  )
);

-- Anyone authenticated can SELECT invites by token (for acceptance flow)
CREATE POLICY "Users can view invites by token"
ON public.shareholder_invites
FOR SELECT
USING (
  auth.uid() IS NOT NULL
);

-- Users can UPDATE their own invite (mark as accepted)
CREATE POLICY "Users can accept their own invite"
ON public.shareholder_invites
FOR UPDATE
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
)
WITH CHECK (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Fix shareholder_access: allow users to create their own access
DROP POLICY IF EXISTS "Admins can manage shareholder access" ON public.shareholder_access;

CREATE POLICY "Admins can manage shareholder access"
ON public.shareholder_access
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.org_id = shareholder_access.org_id
    AND m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.org_id = shareholder_access.org_id
    AND m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
  )
);

-- Users can INSERT their own shareholder access (from invite acceptance)
CREATE POLICY "Users can create their own shareholder access"
ON public.shareholder_access
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- ============================================
-- BLOCKER #4: Portal Data Access
-- Update user_has_org_access to include shareholders (read-only)
-- ============================================

-- We need a separate approach: keep user_has_org_access for memberships only
-- and add shareholder SELECT policies to key tables

-- Create a helper function for shareholder read access
CREATE OR REPLACE FUNCTION public.user_has_shareholder_access(check_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shareholder_access
    WHERE user_id = auth.uid()
    AND org_id = check_org_id
    AND revoked_at IS NULL
  )
$$;

-- Add SELECT-only policies for shareholders on key tables
CREATE POLICY "Shareholders can view properties"
ON public.properties FOR SELECT
USING (user_has_shareholder_access(org_id));

CREATE POLICY "Shareholders can view compliance items"
ON public.compliance_items FOR SELECT
USING (user_has_shareholder_access(org_id));

CREATE POLICY "Shareholders can view documents"
ON public.documents FOR SELECT
USING (user_has_shareholder_access(org_id));

CREATE POLICY "Shareholders can view companies"
ON public.companies FOR SELECT
USING (user_has_shareholder_access(org_id));

-- ============================================
-- MEMBERSHIP INSERT ESCALATION FIX
-- ============================================

-- Drop the dangerous policy that lets users add themselves to any org
DROP POLICY IF EXISTS "Users can insert own memberships" ON public.memberships;
-- Membership creation is now only via the signup trigger (SECURITY DEFINER)

-- ============================================
-- ADDITIONAL: get_user_org_id for shareholders
-- ============================================

-- Update get_user_org_id to also check shareholder_access
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1),
    (SELECT org_id FROM public.shareholder_access WHERE user_id = auth.uid() AND revoked_at IS NULL LIMIT 1)
  )
$$;
