-- #54b precursor: rewrite tenant-portal storage policy onto V2, drop orphaned V1 compliance-seed function.
-- tenant_portal_access is empty (verified 2026-05-08) — no backfill required.

DROP POLICY IF EXISTS "Tenants can read their property documents" ON storage.objects;

CREATE POLICY "Tenants can read their property documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.tenant_portal_access tpa
    JOIN public.tenancy_agreements ta ON ta.id = tpa.tenancy_id
    JOIN public.properties_v2 p ON p.id = ta.property_id
    WHERE tpa.user_id = auth.uid()
      AND tpa.revoked_at IS NULL
      AND tpa.can_view_documents = true
      AND (storage.foldername(objects.name))[1] = p.org_id::text
  )
);

DROP FUNCTION IF EXISTS public.generate_tenancy_compliance_items(public.tenancies);