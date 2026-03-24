-- Align shareholder portal permissions with the v2 portal surface.
-- Shareholders should have read-only access scoped by feature flags, while
-- management policies stay restricted to org members.

CREATE OR REPLACE FUNCTION public.user_has_shareholder_financials_access(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shareholder_access
    WHERE user_id = auth.uid()
      AND org_id = check_org_id
      AND revoked_at IS NULL
      AND can_view_financials IS TRUE
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_shareholder_compliance_access(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shareholder_access
    WHERE user_id = auth.uid()
      AND org_id = check_org_id
      AND revoked_at IS NULL
      AND can_view_compliance IS TRUE
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_shareholder_documents_access(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shareholder_access
    WHERE user_id = auth.uid()
      AND org_id = check_org_id
      AND revoked_at IS NULL
      AND can_view_documents IS TRUE
  )
$$;

DROP POLICY IF EXISTS "Users can manage own org compliance_documents_v2" ON public.compliance_documents_v2;
DROP POLICY IF EXISTS "Users can manage own org compliance_requirements_v2" ON public.compliance_requirements_v2;
DROP POLICY IF EXISTS "Users can manage own org compliance_contractors_v2" ON public.compliance_contractors_v2;
DROP POLICY IF EXISTS "Users can manage own org financial_snapshots" ON public.financial_snapshots;
DROP POLICY IF EXISTS "Shareholders can view compliance items" ON public.compliance_items;
DROP POLICY IF EXISTS "Shareholders can view documents" ON public.documents;

CREATE POLICY "Org members can manage compliance_documents_v2"
  ON public.compliance_documents_v2 FOR ALL
  USING (public.user_has_org_access(org_id))
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Org members can manage compliance_requirements_v2"
  ON public.compliance_requirements_v2 FOR ALL
  USING (public.user_has_org_access(org_id))
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Org members can manage compliance_contractors_v2"
  ON public.compliance_contractors_v2 FOR ALL
  USING (public.user_has_org_access(org_id))
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Org members can manage financial_snapshots"
  ON public.financial_snapshots FOR ALL
  USING (public.user_has_org_access(org_id))
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Shareholders can view properties_v2"
  ON public.properties_v2 FOR SELECT
  USING (public.user_has_shareholder_access(org_id));

CREATE POLICY "Shareholders can view legal entities"
  ON public.legal_entities FOR SELECT
  USING (public.user_has_shareholder_access(org_id));

CREATE POLICY "Shareholders can view lenders"
  ON public.lenders FOR SELECT
  USING (public.user_has_shareholder_financials_access(org_id));

CREATE POLICY "Shareholders can view loan facilities"
  ON public.loan_facilities FOR SELECT
  USING (public.user_has_shareholder_financials_access(org_id));

CREATE POLICY "Shareholders can view financial snapshots"
  ON public.financial_snapshots FOR SELECT
  USING (public.user_has_shareholder_financials_access(org_id));

CREATE POLICY "Shareholders can view compliance documents v2"
  ON public.compliance_documents_v2 FOR SELECT
  USING (public.user_has_shareholder_compliance_access(org_id));

CREATE POLICY "Shareholders can view compliance requirements v2"
  ON public.compliance_requirements_v2 FOR SELECT
  USING (public.user_has_shareholder_compliance_access(org_id));

CREATE POLICY "Shareholders can view compliance contractors v2"
  ON public.compliance_contractors_v2 FOR SELECT
  USING (public.user_has_shareholder_compliance_access(org_id));

CREATE POLICY "Shareholders can view compliance items"
  ON public.compliance_items FOR SELECT
  USING (public.user_has_shareholder_compliance_access(org_id));

CREATE POLICY "Shareholders can view documents"
  ON public.documents FOR SELECT
  USING (public.user_has_shareholder_documents_access(org_id));

CREATE POLICY "Shareholders can view photos"
  ON public.photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = photos.property_id
        AND public.user_has_shareholder_access(p.org_id)
    )
  );

CREATE POLICY "Shareholders can view distributions"
  ON public.distributions FOR SELECT
  USING (public.user_has_shareholder_financials_access(org_id));

CREATE POLICY "Shareholders can view distribution allocations"
  ON public.distribution_allocations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.distributions d
      WHERE d.id = distribution_allocations.distribution_id
        AND public.user_has_shareholder_financials_access(d.org_id)
    )
  );
