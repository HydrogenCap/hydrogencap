-- Finding A: Lock down profile role columns at the privilege layer.
-- Defense-in-depth: existing prevent_platform_role_change() trigger remains in place.
-- The REVOKE makes the columns non-writable via PostgREST/Data API for anon & authenticated
-- roles, so the scanner sees the surface area is closed. Service_role bypasses RLS and
-- column grants, so edge functions / admin RPCs can still promote users.
REVOKE UPDATE (platform_role, role) ON public.profiles FROM authenticated;
REVOKE UPDATE (platform_role, role) ON public.profiles FROM anon;

-- Finding B: Scope tenant document storage access to their own tenancy's documents,
-- not the whole org folder. Anchored to public.documents rows tagged with tenancy_id
-- and visible_to_tenants = true. Org-member staff policies are unaffected.
DROP POLICY IF EXISTS "Tenants can read their property documents" ON storage.objects;
DROP POLICY IF EXISTS "Tenants can read their tenancy documents" ON storage.objects;
CREATE POLICY "Tenants can read their tenancy documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1
      FROM public.documents d
      JOIN public.tenant_portal_access tpa
        ON tpa.tenancy_id = d.tenancy_id
      WHERE tpa.user_id = auth.uid()
        AND tpa.revoked_at IS NULL
        AND tpa.can_view_documents = true
        AND COALESCE(d.visible_to_tenants, false) = true
        AND d.deleted_at IS NULL
        AND d.file_url LIKE '%' || storage.objects.name
    )
  );
