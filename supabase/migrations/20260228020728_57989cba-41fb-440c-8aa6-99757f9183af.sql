
-- =============================================
-- P0 FIX: Tighten storage bucket RLS policies
-- Scope photos, compliance-documents, maintenance-photos, 
-- and investor-reports to user's organisation
-- =============================================

-- Helper function: check if user belongs to org that owns a property
CREATE OR REPLACE FUNCTION public.user_owns_property_folder(folder_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.properties p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid()
      AND p.id::text = folder_name
  )
$$;

-- =============================================
-- 1. PHOTOS bucket — currently PUBLIC SELECT
-- =============================================

-- Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Public can view photos" ON storage.objects;

-- Replace with org-scoped SELECT (photos stored as {propertyId}/{file})
CREATE POLICY "Org members can view photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'photos'
    AND auth.role() = 'authenticated'
    AND public.user_owns_property_folder((storage.foldername(name))[1])
  );

-- =============================================
-- 2. COMPLIANCE-DOCUMENTS bucket — currently auth-only
-- =============================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can read compliance docs v2" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload compliance docs v2" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete compliance docs v2" ON storage.objects;

-- Org-scoped SELECT (compliance-documents stored as {propertyId}/{docType}/{file})
CREATE POLICY "Org members can read compliance docs v2"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'compliance-documents'
    AND auth.role() = 'authenticated'
    AND public.user_owns_property_folder((storage.foldername(name))[1])
  );

-- Org-scoped INSERT
CREATE POLICY "Org members can upload compliance docs v2"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'compliance-documents'
    AND auth.role() = 'authenticated'
    AND public.user_owns_property_folder((storage.foldername(name))[1])
  );

-- Org-scoped DELETE
CREATE POLICY "Org members can delete compliance docs v2"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'compliance-documents'
    AND auth.role() = 'authenticated'
    AND public.user_owns_property_folder((storage.foldername(name))[1])
  );

-- =============================================
-- 3. MAINTENANCE-PHOTOS bucket — currently auth-only
-- =============================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "org_members_view_maintenance_photos" ON storage.objects;
DROP POLICY IF EXISTS "org_members_upload_maintenance_photos" ON storage.objects;
DROP POLICY IF EXISTS "org_members_delete_maintenance_photos" ON storage.objects;

-- Helper: check if user belongs to org that owns a maintenance request
CREATE OR REPLACE FUNCTION public.user_owns_maintenance_folder(folder_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.maintenance_requests mr
    JOIN public.memberships m ON m.org_id = mr.org_id
    WHERE m.user_id = auth.uid()
      AND mr.id::text = folder_name
  )
$$;

-- Org-scoped SELECT
CREATE POLICY "Org members can view maintenance photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'maintenance-photos'
    AND auth.role() = 'authenticated'
    AND public.user_owns_maintenance_folder((storage.foldername(name))[1])
  );

-- Org-scoped INSERT
CREATE POLICY "Org members can upload maintenance photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'maintenance-photos'
    AND auth.role() = 'authenticated'
    AND public.user_owns_maintenance_folder((storage.foldername(name))[1])
  );

-- Org-scoped DELETE
CREATE POLICY "Org members can delete maintenance photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'maintenance-photos'
    AND auth.role() = 'authenticated'
    AND public.user_owns_maintenance_folder((storage.foldername(name))[1])
  );

-- =============================================
-- 4. INVESTOR-REPORTS bucket — currently auth-only
-- Files stored as investor-reports/{date}/{filename}
-- Scope via investor_reports table → org membership
-- =============================================

-- Drop overly permissive policy
DROP POLICY IF EXISTS "ir_view" ON storage.objects;

-- Helper: check if any investor report in user's org references this file
CREATE OR REPLACE FUNCTION public.user_can_access_investor_report(file_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.investor_reports ir
    JOIN public.memberships m ON m.org_id = ir.org_id
    WHERE m.user_id = auth.uid()
      AND ir.file_url LIKE '%' || file_name || '%'
  )
$$;

-- Org-scoped SELECT for investor reports
CREATE POLICY "Org members can view investor reports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'investor-reports'
    AND auth.role() = 'authenticated'
    AND public.user_can_access_investor_report(name)
  );
