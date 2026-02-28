
-- =============================================
-- V2: Fix compliance storage RLS — scope to organisation
-- =============================================

-- ─── compliance bucket — drop old AND new-named policies ───
DROP POLICY IF EXISTS "Users can view compliance files in their org" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload compliance files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update compliance files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete compliance files" ON storage.objects;
DROP POLICY IF EXISTS "Org members can read compliance files" ON storage.objects;
DROP POLICY IF EXISTS "Org members can upload compliance files" ON storage.objects;
DROP POLICY IF EXISTS "Org members can update compliance files" ON storage.objects;
DROP POLICY IF EXISTS "Org members can delete compliance files" ON storage.objects;

CREATE POLICY "Org members can read compliance files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'compliance'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM public.memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can upload compliance files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'compliance'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM public.memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update compliance files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'compliance'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM public.memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete compliance files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'compliance'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM public.memberships WHERE user_id = auth.uid()
    )
  );

-- ─── compliance-documents bucket (V2) — drop old AND new-named policies ───
DROP POLICY IF EXISTS "Authenticated users can read compliance docs v2" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload compliance docs v2" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete compliance docs v2" ON storage.objects;
DROP POLICY IF EXISTS "Org members can read compliance docs v2" ON storage.objects;
DROP POLICY IF EXISTS "Org members can upload compliance docs v2" ON storage.objects;
DROP POLICY IF EXISTS "Org members can delete compliance docs v2" ON storage.objects;

CREATE POLICY "Org members can read compliance docs v2"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'compliance-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM public.memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can upload compliance docs v2"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'compliance-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM public.memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete compliance docs v2"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'compliance-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM public.memberships WHERE user_id = auth.uid()
    )
  );
