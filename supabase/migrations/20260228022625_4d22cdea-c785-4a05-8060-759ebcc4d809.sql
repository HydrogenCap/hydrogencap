-- Tenant portal: tenants can read documents for their tenancy's property
CREATE POLICY "Tenants can read their property documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.tenant_portal_access tpa
      JOIN public.tenancies t ON tpa.tenancy_id = t.id
      JOIN public.properties p ON t.property_id = p.id
      WHERE tpa.user_id = auth.uid()
        AND tpa.revoked_at IS NULL
        AND (storage.foldername(name))[1] = p.org_id::text
    )
  );