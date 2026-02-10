
-- Tighten the share link UPDATE policy: only allow updating view_count and last_viewed_at
-- We can't restrict column-level updates via RLS, but we can scope it to active, non-expired links
DROP POLICY IF EXISTS "Anyone can update view count on active share links" ON public.document_share_links;

-- More restrictive: only allow update on active links that haven't expired
CREATE POLICY "Anon can increment view count on valid share links"
ON public.document_share_links
FOR UPDATE
USING (
  is_active = true 
  AND expires_at > now()
  AND (max_views IS NULL OR view_count < max_views)
)
WITH CHECK (
  is_active = true
);
