-- @allow-v1-refs: pre-cutover historical migration referencing §0a V1 tables (loans/tenancies/costs/income); baked-in DB history, not new code.
-- Bring tenant portal access flags into database policy enforcement.

CREATE OR REPLACE FUNCTION public.user_has_tenant_rent_access(check_tenancy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_portal_access
    WHERE user_id = auth.uid()
      AND tenancy_id = check_tenancy_id
      AND revoked_at IS NULL
      AND can_view_rent IS TRUE
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_tenant_documents_access(check_tenancy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_portal_access
    WHERE user_id = auth.uid()
      AND tenancy_id = check_tenancy_id
      AND revoked_at IS NULL
      AND can_view_documents IS TRUE
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_tenant_maintenance_access(check_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_portal_access
    WHERE user_id = auth.uid()
      AND tenant_id = check_tenant_id
      AND revoked_at IS NULL
      AND can_submit_maintenance IS TRUE
  )
$$;

DROP POLICY IF EXISTS "Tenants can view own rent schedule" ON public.rent_schedule;
DROP POLICY IF EXISTS "Tenants can view own rent payments" ON public.rent_payments;
DROP POLICY IF EXISTS "Tenants can view own maintenance requests" ON public.maintenance_requests;
DROP POLICY IF EXISTS "Tenants can create maintenance requests" ON public.maintenance_requests;
DROP POLICY IF EXISTS "tenant_portal_access" ON public.maintenance_requests;
DROP POLICY IF EXISTS "tenant_portal_insert" ON public.maintenance_requests;
DROP POLICY IF EXISTS "tenant_portal_comments" ON public.maintenance_comments;
DROP POLICY IF EXISTS "Authenticated users can upload maintenance photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view maintenance photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete maintenance photos" ON storage.objects;

CREATE POLICY "Tenants can view own rent schedule"
  ON public.rent_schedule FOR SELECT
  USING (public.user_has_tenant_rent_access(tenancy_id));

CREATE POLICY "Tenants can view own rent payments"
  ON public.rent_payments FOR SELECT
  USING (public.user_has_tenant_rent_access(tenancy_id));

CREATE POLICY "Tenants can view shared documents"
  ON public.documents FOR SELECT
  USING (
    tenancy_id IS NOT NULL
    AND visible_to_tenants IS TRUE
    AND deleted_at IS NULL
    AND public.user_has_tenant_documents_access(tenancy_id)
  );

CREATE POLICY "Tenants can view own maintenance requests"
  ON public.maintenance_requests FOR SELECT
  USING (public.user_has_tenant_maintenance_access(tenant_id));

CREATE POLICY "Tenants can create maintenance requests"
  ON public.maintenance_requests FOR INSERT
  WITH CHECK (
    reported_by = 'tenant'
    AND EXISTS (
      SELECT 1
      FROM public.tenant_portal_access tpa
      JOIN public.tenancies t ON t.id = tpa.tenancy_id
      WHERE tpa.user_id = auth.uid()
        AND tpa.revoked_at IS NULL
        AND tpa.can_submit_maintenance IS TRUE
        AND tpa.tenant_id = maintenance_requests.tenant_id
        AND tpa.org_id = maintenance_requests.org_id
        AND t.property_id = maintenance_requests.property_id
    )
  );

CREATE POLICY "Tenants can view public maintenance comments"
  ON public.maintenance_comments FOR SELECT
  USING (
    COALESCE(is_internal, false) IS FALSE
    AND EXISTS (
      SELECT 1
      FROM public.maintenance_requests mr
      WHERE mr.id = maintenance_comments.maintenance_request_id
        AND public.user_has_tenant_maintenance_access(mr.tenant_id)
    )
  );