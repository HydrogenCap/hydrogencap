-- Job Notes table
CREATE TABLE public.job_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.contractor_jobs(id) ON DELETE CASCADE NOT NULL,
  note TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_notes_job ON public.job_notes(job_id);

ALTER TABLE public.job_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage job notes"
ON public.job_notes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM contractor_jobs cj
    WHERE cj.id = job_notes.job_id
    AND public.user_has_org_access(cj.org_id)
  )
);

-- Enhance existing insurance_policies table
ALTER TABLE public.insurance_policies 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS policy_type TEXT DEFAULT 'landlord',
  ADD COLUMN IF NOT EXISTS payment_frequency TEXT DEFAULT 'annual',
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS buildings_cover_gbp INTEGER,
  ADD COLUMN IF NOT EXISTS contents_cover_gbp INTEGER,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add RLS if not already enabled
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists and recreate
DROP POLICY IF EXISTS "Org members manage insurance" ON public.insurance_policies;

CREATE POLICY "Org members manage insurance"
ON public.insurance_policies
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = insurance_policies.property_id
    AND public.user_has_org_access(p.org_id)
  )
);