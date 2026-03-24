-- Finish tenant maintenance parity for legacy maintenance_updates and
-- tenant-authored maintenance comments.
-- The current tenant portal no longer uses tenants.portal_user_id, so any
-- tenant-facing maintenance table still relying on that model will drift out of
-- sync with modern invite acceptance.

DROP POLICY IF EXISTS "Tenants view visible updates" ON public.maintenance_updates;
DROP POLICY IF EXISTS "Tenants create updates" ON public.maintenance_updates;
DROP POLICY IF EXISTS "Tenants can add public maintenance comments" ON public.maintenance_comments;

CREATE POLICY "Tenants view visible updates"
  ON public.maintenance_updates FOR SELECT
  USING (
    visible_to_tenant IS TRUE
    AND EXISTS (
      SELECT 1
      FROM public.maintenance_requests mr
      WHERE mr.id = maintenance_updates.request_id
        AND public.user_has_tenant_maintenance_access(mr.tenant_id)
    )
  );

CREATE POLICY "Tenants create updates"
  ON public.maintenance_updates FOR INSERT
  WITH CHECK (
    created_by_type = 'tenant'
    AND visible_to_tenant IS TRUE
    AND new_status IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.maintenance_requests mr
      WHERE mr.id = maintenance_updates.request_id
        AND public.user_has_tenant_maintenance_access(mr.tenant_id)
    )
  );

CREATE POLICY "Tenants can add public maintenance comments"
  ON public.maintenance_comments FOR INSERT
  WITH CHECK (
    author_type = 'tenant'
    AND COALESCE(is_internal, false) IS FALSE
    AND EXISTS (
      SELECT 1
      FROM public.maintenance_requests mr
      WHERE mr.id = maintenance_comments.maintenance_request_id
        AND mr.org_id = maintenance_comments.org_id
        AND public.user_has_tenant_maintenance_access(mr.tenant_id)
    )
  );
