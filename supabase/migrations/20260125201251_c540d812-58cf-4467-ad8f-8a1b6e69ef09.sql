-- First create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create property_beneficial_owners table for tracking beneficial ownership
-- This stores the ultimate beneficial owners (people or companies) with their percentage stakes

CREATE TABLE public.property_beneficial_owners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('COMPANY', 'PERSON')),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  party_id UUID REFERENCES public.parties(id) ON DELETE CASCADE,
  beneficial_percent NUMERIC(5,2) NOT NULL CHECK (beneficial_percent >= 0 AND beneficial_percent <= 100),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Validation constraints
  CONSTRAINT company_or_party_required CHECK (
    (owner_type = 'COMPANY' AND company_id IS NOT NULL AND party_id IS NULL) OR
    (owner_type = 'PERSON' AND party_id IS NOT NULL AND company_id IS NULL)
  )
);

-- Create index for efficient querying
CREATE INDEX idx_property_beneficial_owners_property ON public.property_beneficial_owners(property_id);
CREATE INDEX idx_property_beneficial_owners_company ON public.property_beneficial_owners(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_property_beneficial_owners_party ON public.property_beneficial_owners(party_id) WHERE party_id IS NOT NULL;

-- Create unique constraint to prevent duplicates (for active records)
CREATE UNIQUE INDEX idx_property_beneficial_unique_company 
  ON public.property_beneficial_owners(property_id, company_id) 
  WHERE company_id IS NOT NULL AND end_date IS NULL;

CREATE UNIQUE INDEX idx_property_beneficial_unique_party 
  ON public.property_beneficial_owners(property_id, party_id) 
  WHERE party_id IS NOT NULL AND end_date IS NULL;

-- Enable RLS
ALTER TABLE public.property_beneficial_owners ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view beneficial owners for their properties"
  ON public.property_beneficial_owners
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_beneficial_owners.property_id
    AND user_has_org_access(p.org_id)
  ));

CREATE POLICY "Users can insert beneficial owners for their properties"
  ON public.property_beneficial_owners
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_beneficial_owners.property_id
    AND user_has_org_access(p.org_id)
  ));

CREATE POLICY "Users can update beneficial owners for their properties"
  ON public.property_beneficial_owners
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_beneficial_owners.property_id
    AND user_has_org_access(p.org_id)
  ));

CREATE POLICY "Users can delete beneficial owners for their properties"
  ON public.property_beneficial_owners
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_beneficial_owners.property_id
    AND user_has_org_access(p.org_id)
  ));

-- Create trigger for updated_at
CREATE TRIGGER update_property_beneficial_owners_updated_at
  BEFORE UPDATE ON public.property_beneficial_owners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();