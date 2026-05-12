-- @allow-v1-refs: pre-cutover historical migration referencing §0a V1 tables (loans/tenancies/costs/income); baked-in DB history, not new code.
-- Align tenant portal base table reads with tenant_portal_access.
-- The portal UI now authenticates against tenant_portal_access, but the older
-- tenant/tenancy policies were still keyed only off tenants.portal_user_id.
-- Keep legacy portal_user_id compatibility while granting the modern access path.

CREATE OR REPLACE FUNCTION public.user_has_tenant_profile_access(check_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_portal_access tpa
    WHERE tpa.user_id = auth.uid()
      AND tpa.tenant_id = check_tenant_id
      AND tpa.revoked_at IS NULL
  )
  OR EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = check_tenant_id
      AND t.portal_user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_tenancy_portal_access(check_tenancy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_portal_access tpa
    WHERE tpa.user_id = auth.uid()
      AND tpa.tenancy_id = check_tenancy_id
      AND tpa.revoked_at IS NULL
  )
  OR EXISTS (
    SELECT 1
    FROM public.tenancies tn
    JOIN public.tenants t ON t.id = tn.tenant_id
    WHERE tn.id = check_tenancy_id
      AND t.portal_user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_tenant_room_access(check_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenancies tn
    WHERE tn.room_id = check_room_id
      AND public.user_has_tenancy_portal_access(tn.id)
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_tenant_property_access(check_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenancies tn
    WHERE tn.property_id = check_property_id
      AND public.user_has_tenancy_portal_access(tn.id)
  )
$$;

DROP POLICY IF EXISTS "Tenants view own profile" ON public.tenants;
DROP POLICY IF EXISTS "Tenants view own tenancies" ON public.tenancies;

CREATE POLICY "Tenants view own profile"
  ON public.tenants FOR SELECT
  USING (public.user_has_tenant_profile_access(id));

CREATE POLICY "Tenants view own tenancies"
  ON public.tenancies FOR SELECT
  USING (public.user_has_tenancy_portal_access(id));

CREATE POLICY "Tenants view own rooms"
  ON public.rooms FOR SELECT
  USING (public.user_has_tenant_room_access(id));

CREATE POLICY "Tenants view own properties"
  ON public.properties FOR SELECT
  USING (public.user_has_tenant_property_access(id));
