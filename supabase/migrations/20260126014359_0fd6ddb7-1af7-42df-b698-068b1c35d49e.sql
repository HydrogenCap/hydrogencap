-- =============================================
-- Fix Storage Bucket Security: Add org-based access control
-- =============================================

-- First, drop existing weak policies on all buckets
DROP POLICY IF EXISTS "Allow authenticated uploads to documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view floorplans" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload floorplans" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update floorplans" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete floorplans" ON storage.objects;

-- =============================================
-- DOCUMENTS BUCKET: Private, org-scoped access
-- Files are stored as: {org_id}/{filename}
-- =============================================

-- Policy: Users can view documents in their org folder
CREATE POLICY "Org members can view documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT org_id::text FROM public.memberships WHERE user_id = auth.uid()
  )
);

-- Policy: Users can upload documents to their org folder
CREATE POLICY "Org members can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT org_id::text FROM public.memberships WHERE user_id = auth.uid()
  )
);

-- Policy: Users can delete documents from their org folder
CREATE POLICY "Org members can delete documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT org_id::text FROM public.memberships WHERE user_id = auth.uid()
  )
);

-- =============================================
-- PHOTOS BUCKET: Public viewing, org-scoped upload/delete
-- Files are stored as: {property_id}/{filename}
-- We validate access via property -> org relationship
-- =============================================

-- Policy: Anyone can view photos (intentionally public for sharing)
CREATE POLICY "Public can view photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

-- Policy: Users can upload photos for properties in their org
CREATE POLICY "Org members can upload photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM public.properties p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid()
  )
);

-- Policy: Users can delete photos for properties in their org
CREATE POLICY "Org members can delete photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM public.properties p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid()
  )
);

-- =============================================
-- FLOORPLANS BUCKET: Public viewing, org-scoped upload/delete
-- Files are stored as: {property_id}/{filename}
-- We validate access via property -> org relationship
-- =============================================

-- Policy: Anyone can view floorplans (intentionally public for sharing)
CREATE POLICY "Public can view floorplans"
ON storage.objects FOR SELECT
USING (bucket_id = 'floorplans');

-- Policy: Users can upload floorplans for properties in their org
CREATE POLICY "Org members can upload floorplans"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'floorplans'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM public.properties p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid()
  )
);

-- Policy: Users can update floorplans for properties in their org
CREATE POLICY "Org members can update floorplans"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'floorplans'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM public.properties p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid()
  )
);

-- Policy: Users can delete floorplans for properties in their org
CREATE POLICY "Org members can delete floorplans"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'floorplans'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM public.properties p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid()
  )
);