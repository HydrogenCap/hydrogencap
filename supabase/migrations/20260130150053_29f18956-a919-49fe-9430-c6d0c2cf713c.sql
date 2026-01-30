-- ============================================
-- Core Property Identity (DNA) Enhancement
-- ============================================

-- Add new columns to properties table
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS property_name TEXT NULL,
ADD COLUMN IF NOT EXISTS planning_authority TEXT NULL,
ADD COLUMN IF NOT EXISTS conservation_area BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS year_built TEXT NULL,
ADD COLUMN IF NOT EXISTS construction_type TEXT NULL,
ADD COLUMN IF NOT EXISTS identity_updated_at TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN IF NOT EXISTS identity_updated_by UUID NULL;

-- Set default listed_status for existing properties if not already set
UPDATE public.properties 
SET listed_status = 'Not listed'
WHERE listed_status IS NULL;

-- Set default planning_authority from local_authority if passport has one
UPDATE public.properties p
SET planning_authority = pp.local_authority_text
FROM public.property_passport pp
WHERE p.id = pp.property_id
AND pp.local_authority_text IS NOT NULL
AND p.planning_authority IS NULL;

-- Create property_title_numbers table for multiple title numbers
CREATE TABLE IF NOT EXISTS public.property_title_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  title_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NULL,
  CONSTRAINT unique_property_title_number UNIQUE (property_id, title_number)
);

-- Enable RLS on property_title_numbers
ALTER TABLE public.property_title_numbers ENABLE ROW LEVEL SECURITY;

-- RLS policies for property_title_numbers
CREATE POLICY "Users can view title numbers for their org properties"
ON public.property_title_numbers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_title_numbers.property_id
    AND user_has_org_access(p.org_id)
  )
);

CREATE POLICY "Users can insert title numbers for their org properties"
ON public.property_title_numbers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_title_numbers.property_id
    AND user_has_org_access(p.org_id)
  )
);

CREATE POLICY "Users can update title numbers for their org properties"
ON public.property_title_numbers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_title_numbers.property_id
    AND user_has_org_access(p.org_id)
  )
);

CREATE POLICY "Users can delete title numbers for their org properties"
ON public.property_title_numbers
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_title_numbers.property_id
    AND user_has_org_access(p.org_id)
  )
);

-- Migrate existing single title_number to the new table for properties that have one
INSERT INTO public.property_title_numbers (property_id, title_number)
SELECT id, title_number
FROM public.properties
WHERE title_number IS NOT NULL AND title_number != ''
ON CONFLICT (property_id, title_number) DO NOTHING;

-- Add indexes for search/filter performance
CREATE INDEX IF NOT EXISTS idx_properties_property_type ON public.properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_listed_status ON public.properties(listed_status);
CREATE INDEX IF NOT EXISTS idx_properties_conservation_area ON public.properties(conservation_area);
CREATE INDEX IF NOT EXISTS idx_properties_uprn ON public.properties(uprn);
CREATE INDEX IF NOT EXISTS idx_properties_postcode ON public.properties(postcode);
CREATE INDEX IF NOT EXISTS idx_property_title_numbers_title_number ON public.property_title_numbers(title_number);
CREATE INDEX IF NOT EXISTS idx_property_title_numbers_property_id ON public.property_title_numbers(property_id);