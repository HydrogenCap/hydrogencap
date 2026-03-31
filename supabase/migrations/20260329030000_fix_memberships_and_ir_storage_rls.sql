-- ============================================================
-- Fix 1 (HIGH): memberships INSERT — drop self-join-to-any-org policy
--
-- The "Users can insert own memberships" policy only checks
-- auth.uid() = user_id, which lets any authenticated user
-- INSERT INTO memberships with any org_id and role (including 'owner').
--
-- The accept_team_invite function is SECURITY DEFINER and bypasses
-- RLS, so this open policy is unnecessary and dangerous.
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own memberships" ON public.memberships;

-- ============================================================
-- Fix 2 (MEDIUM): investor-reports storage — org-scope ir_upload + ir_delete
--
-- The original policies only checked auth.uid() IS NOT NULL,
-- allowing any authenticated user to write/delete across all orgs.
-- ============================================================
DROP POLICY IF EXISTS "ir_upload" ON storage.objects;
DROP POLICY IF EXISTS "ir_delete" ON storage.objects;

-- Upload: user must be a member of the org whose folder they are uploading into.
-- Files are stored as <org_id>/<filename>, so foldername[1] = org_id.
CREATE POLICY "ir_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'investor-reports'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM public.memberships WHERE user_id = auth.uid()
    )
  );

-- Delete: user must have access to the investor report that references the file.
CREATE POLICY "ir_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'investor-reports'
    AND auth.role() = 'authenticated'
    AND public.user_can_access_investor_report(name)
  );
