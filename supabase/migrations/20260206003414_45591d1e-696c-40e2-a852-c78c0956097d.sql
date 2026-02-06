-- Enable RLS on certificate_type_mappings (read-only reference data)
ALTER TABLE public.certificate_type_mappings ENABLE ROW LEVEL SECURITY;

-- Allow anyone authenticated to read the mappings (reference data)
CREATE POLICY "Anyone can read certificate type mappings"
ON public.certificate_type_mappings
FOR SELECT
USING (true);