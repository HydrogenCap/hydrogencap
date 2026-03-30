-- Restrict certificate_type_mappings to authenticated users only
DROP POLICY IF EXISTS "Anyone can read certificate type mappings" ON public.certificate_type_mappings;
CREATE POLICY "Authenticated users can read certificate type mappings"
ON public.certificate_type_mappings
FOR SELECT
TO authenticated
USING (true);