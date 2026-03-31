-- Enforce soft delete in documents RLS SELECT policies.
-- The documents table uses deleted_at for soft deletion but the two main SELECT
-- policies did not filter out soft-deleted rows, so deleted documents were still
-- visible to users and shareholders via the API.

DROP POLICY IF EXISTS "Users can view documents in their org" ON public.documents;
CREATE POLICY "Users can view documents in their org"
ON public.documents FOR SELECT
USING (public.user_has_org_access(org_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Shareholders can view documents" ON public.documents;
CREATE POLICY "Shareholders can view documents"
ON public.documents FOR SELECT
USING (public.user_has_shareholder_access(org_id) AND deleted_at IS NULL);
