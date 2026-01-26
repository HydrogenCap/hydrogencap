-- Add legal_owner_party_id to allow individual person ownership
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS legal_owner_party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_properties_legal_owner_party_id 
ON public.properties(legal_owner_party_id);

-- Add constraint to ensure only one of company or party is set
-- (A property can be owned by a company OR a person, not both)
ALTER TABLE public.properties
ADD CONSTRAINT chk_single_legal_owner 
CHECK (
  (legal_owner_company_id IS NULL AND legal_owner_party_id IS NULL) OR
  (legal_owner_company_id IS NOT NULL AND legal_owner_party_id IS NULL) OR
  (legal_owner_company_id IS NULL AND legal_owner_party_id IS NOT NULL)
);