-- Drop the existing SELECT policy that expects org_id as first folder
DROP POLICY IF EXISTS "Org members can view compliance files" ON storage.objects;

-- Create a new SELECT policy that matches the actual file structure (property_id as first folder)
CREATE POLICY "Org members can view compliance files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'compliance'
  AND auth.role() = 'authenticated'
  AND (
    -- Match property_id-based paths: compliance/{property_id}/...
    (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM properties p
      JOIN memberships m ON m.org_id = p.org_id
      WHERE m.user_id = auth.uid()
    )
    OR
    -- Also match org_id-based paths for any future uploads
    (storage.foldername(name))[1] IN (
      SELECT m.org_id::text FROM memberships m
      WHERE m.user_id = auth.uid()
    )
  )
);

-- Also fix the upload/update/delete policies to support both patterns
DROP POLICY IF EXISTS "Org members can upload compliance files" ON storage.objects;
CREATE POLICY "Org members can upload compliance files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'compliance'
  AND auth.role() = 'authenticated'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM properties p
      JOIN memberships m ON m.org_id = p.org_id
      WHERE m.user_id = auth.uid()
    )
    OR
    (storage.foldername(name))[1] IN (
      SELECT m.org_id::text FROM memberships m
      WHERE m.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Org members can update compliance files" ON storage.objects;
CREATE POLICY "Org members can update compliance files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'compliance'
  AND auth.role() = 'authenticated'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM properties p
      JOIN memberships m ON m.org_id = p.org_id
      WHERE m.user_id = auth.uid()
    )
    OR
    (storage.foldername(name))[1] IN (
      SELECT m.org_id::text FROM memberships m
      WHERE m.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Org members can delete compliance files" ON storage.objects;
CREATE POLICY "Org members can delete compliance files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'compliance'
  AND auth.role() = 'authenticated'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM properties p
      JOIN memberships m ON m.org_id = p.org_id
      WHERE m.user_id = auth.uid()
    )
    OR
    (storage.foldername(name))[1] IN (
      SELECT m.org_id::text FROM memberships m
      WHERE m.user_id = auth.uid()
    )
  )
);