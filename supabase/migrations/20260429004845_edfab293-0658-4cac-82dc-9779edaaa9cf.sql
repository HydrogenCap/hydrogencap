-- Stage A.3 — Tighten cross-tenant exposure on floorplans storage bucket.
-- Replace the broad anon-readable SELECT policy with an org-scoped one,
-- matching the established pattern used for the `photos` bucket
-- (memory: storage-access-control-v3). Public listing of floorplans across
-- tenants was a cross-tenant leak; legitimate public sharing should use
-- signed URLs.

DROP POLICY IF EXISTS "Public can view floorplans" ON storage.objects;

CREATE POLICY "Org members can view floorplans"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'floorplans'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      JOIN public.memberships m ON m.org_id = p.org_id
      WHERE m.user_id = auth.uid()
        AND (storage.foldername(objects.name))[1] = p.id::text
    )
  );

-- Also flip the bucket itself to private so the storage API does not advertise
-- the bucket as public-readable. Existing app reads should already use signed
-- URLs (project pattern). If any UI surface relied on the public CDN URL it
-- will need to switch to signed URLs — surface in summary.
UPDATE storage.buckets SET public = false WHERE id = 'floorplans';
