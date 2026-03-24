-- Clean up older write policies that relied on get_user_org_id().

DROP POLICY IF EXISTS "Users can create local authorities in their org" ON public.local_authorities;
DROP POLICY IF EXISTS "Users can create management companies in their org" ON public.management_companies;
DROP POLICY IF EXISTS "work_orders_org" ON public.work_orders;
DROP POLICY IF EXISTS "wo_costs_org" ON public.work_order_costs;

CREATE POLICY "Users can create local authorities in their org"
  ON public.local_authorities FOR INSERT
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Users can create management companies in their org"
  ON public.management_companies FOR INSERT
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "work_orders_org"
  ON public.work_orders FOR ALL
  USING (public.user_has_org_access(org_id))
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "wo_costs_org"
  ON public.work_order_costs FOR ALL
  USING (public.user_has_org_access(org_id))
  WITH CHECK (public.user_has_org_access(org_id));