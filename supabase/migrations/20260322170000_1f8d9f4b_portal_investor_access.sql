-- Align investor portal reads and downloads with the private investor-reports bucket.

CREATE OR REPLACE FUNCTION public.get_portal_investor_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_investor public.investors%ROWTYPE;
BEGIN
  SELECT *
  INTO v_investor
  FROM public.investors
  WHERE portal_user_id = auth.uid()
    AND portal_access_enabled = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'investor', NULL,
      'commitments', '[]'::jsonb,
      'distributions', '[]'::jsonb,
      'return_metrics', '[]'::jsonb,
      'reports', '[]'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'investor', to_jsonb(v_investor),
    'commitments', COALESCE((
      SELECT jsonb_agg(to_jsonb(icd) ORDER BY icd.entity_name, icd.commitment_date)
      FROM public.investor_commitment_detail icd
      WHERE icd.investor_id = v_investor.id
    ), '[]'::jsonb),
    'distributions', COALESCE((
      SELECT jsonb_agg(to_jsonb(id2) ORDER BY id2.distribution_date DESC, id2.created_at DESC)
      FROM public.investor_distributions id2
      WHERE id2.investor_id = v_investor.id
    ), '[]'::jsonb),
    'return_metrics', COALESCE((
      SELECT jsonb_agg(to_jsonb(irm) ORDER BY irm.entity_name)
      FROM public.investor_return_metrics irm
      WHERE irm.investor_id = v_investor.id
    ), '[]'::jsonb),
    'reports', COALESCE((
      SELECT jsonb_agg(to_jsonb(ir) ORDER BY ir.generated_at DESC, ir.created_at DESC)
      FROM public.investor_reports ir
      WHERE ir.investor_id = v_investor.id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_portal_investor_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_investor_data() TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_investor_can_access_report_object(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.investor_reports ir
    JOIN public.investors i ON i.id = ir.investor_id
    WHERE i.portal_user_id = auth.uid()
      AND i.portal_access_enabled = true
      AND (
        ir.file_url = object_name
        OR ir.file_url LIKE '%' || object_name
        OR ir.file_name = regexp_replace(object_name, '^.*/', '')
      )
  );
$$;

DROP POLICY IF EXISTS "Portal investors can view investor reports" ON storage.objects;

CREATE POLICY "Portal investors can view investor reports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'investor-reports'
    AND auth.role() = 'authenticated'
    AND public.portal_investor_can_access_report_object(name)
  );
