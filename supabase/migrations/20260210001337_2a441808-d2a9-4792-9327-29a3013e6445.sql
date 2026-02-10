
-- Fix: Restrict demo_requests SELECT to admin/owner roles only
DROP POLICY IF EXISTS "Authenticated users can view demo requests" ON public.demo_requests;

CREATE POLICY "Admins can view demo requests"
ON public.demo_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
  )
);
