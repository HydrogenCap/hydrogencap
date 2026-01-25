-- 1. Add legal_owner_company_id to properties table
-- This is the single source of truth for which SPV legally owns the property
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS legal_owner_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_properties_legal_owner_company_id 
ON public.properties(legal_owner_company_id);

-- 2. Add constraint to property_beneficial_owners to ensure percent is valid
ALTER TABLE public.property_beneficial_owners 
ADD CONSTRAINT check_beneficial_percent_range 
CHECK (beneficial_percent > 0 AND beneficial_percent <= 100);

-- 3. Create a unique constraint to prevent duplicate beneficial owner rows
-- A property cannot have the same owner (company or party) with the same percent
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_beneficial_owner_company
ON public.property_beneficial_owners(property_id, company_id, beneficial_percent)
WHERE company_id IS NOT NULL AND end_date IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_beneficial_owner_party
ON public.property_beneficial_owners(property_id, party_id, beneficial_percent)
WHERE party_id IS NOT NULL AND end_date IS NULL;

-- 4. Add comment for documentation
COMMENT ON COLUMN public.properties.legal_owner_company_id IS 'The SPV/Company that legally owns this property. Single source of truth for legal ownership.';