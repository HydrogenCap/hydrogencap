-- Drop existing policies first, then recreate with proper org scoping
DROP POLICY IF EXISTS "Org members can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Org members can delete photos" ON storage.objects;
DROP POLICY IF EXISTS "Org members can upload floorplans" ON storage.objects;
DROP POLICY IF EXISTS "Org members can delete floorplans" ON storage.objects;

-- Org-scoped upload for photos: path must start with a property_id belonging to user's org
CREATE POLICY "Org members can upload photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'photos'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.properties p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

CREATE POLICY "Org members can delete photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'photos'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.properties p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

CREATE POLICY "Org members can upload floorplans"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'floorplans'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.properties p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

CREATE POLICY "Org members can delete floorplans"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'floorplans'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.properties p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);