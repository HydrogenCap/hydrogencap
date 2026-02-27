-- Add is_principal flag to parties table
-- This marks the party that represents the org's own identity (e.g. Hydrogen Capital)
ALTER TABLE public.parties
ADD COLUMN is_principal boolean NOT NULL DEFAULT false;

-- Ensure only one principal per org
CREATE UNIQUE INDEX idx_parties_one_principal_per_org
ON public.parties (org_id)
WHERE is_principal = true;