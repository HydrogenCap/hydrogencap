-- ============================================================
-- Fix compliance-documents storage RLS
-- Previous migrations created conflicting policies:
--   20260228020728: first segment must be a propertyId
--   20260228023352: first segment must be an orgId
-- This migration supersedes both with a combined OR policy
-- so uploads work regardless of which path format is used.
-- ============================================================

-- Drop every known named variant (IF EXISTS makes these safe to re-run)
DROP POLICY IF EXISTS "Authenticated users can read compliance docs v2"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload compliance docs v2" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete compliance docs v2" ON storage.objects;
DROP POLICY IF EXISTS "Org members can read compliance docs v2"           ON storage.objects;
DROP POLICY IF EXISTS "Org members can upload compliance docs v2"         ON storage.objects;
DROP POLICY IF EXISTS "Org members can delete compliance docs v2"         ON storage.objects;
DROP POLICY IF EXISTS "Org members can read compliance docs"              ON storage.objects;
DROP POLICY IF EXISTS "Org members can upload compliance docs"            ON storage.objects;
DROP POLICY IF EXISTS "Org members can delete compliance docs"            ON storage.objects;

-- ── INSERT ────────────────────────────────────────────────────────────────────
-- Accepts both:
--   • New format  :  {orgId}/...        (insurance scan, compliance intake)
--   • Legacy format:  {propertyId}/...  (older compliance uploads)
CREATE POLICY "compliance_docs_insert_v3"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'compliance-documents'
    AND auth.role() = 'authenticated'
    AND (
      -- path starts with user's org_id
      (storage.foldername(name))[1] IN (
        SELECT org_id::text FROM public.memberships WHERE user_id = auth.uid()
      )
      -- OR path starts with a propertyId that belongs to user's org
      OR public.user_owns_property_folder((storage.foldername(name))[1])
    )
  );

-- ── SELECT ────────────────────────────────────────────────────────────────────
CREATE POLICY "compliance_docs_select_v3"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'compliance-documents'
    AND auth.role() = 'authenticated'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT org_id::text FROM public.memberships WHERE user_id = auth.uid()
      )
      OR public.user_owns_property_folder((storage.foldername(name))[1])
    )
  );

-- ── DELETE ────────────────────────────────────────────────────────────────────
CREATE POLICY "compliance_docs_delete_v3"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'compliance-documents'
    AND auth.role() = 'authenticated'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT org_id::text FROM public.memberships WHERE user_id = auth.uid()
      )
      OR public.user_owns_property_folder((storage.foldername(name))[1])
    )
  );
