-- Add Grade Listed fields to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS is_grade_listed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS listing_grade text,
ADD COLUMN IF NOT EXISTS listing_number text,
ADD COLUMN IF NOT EXISTS heritage_notes text;

-- Add comment for clarity
COMMENT ON COLUMN properties.is_grade_listed IS 'True if property is Grade I, II*, or II listed - exempt from EPC requirements';
COMMENT ON COLUMN properties.listing_grade IS 'Grade of listing: I, II*, or II';
COMMENT ON COLUMN properties.listing_number IS 'Historic England list entry number';
COMMENT ON COLUMN properties.heritage_notes IS 'Notes about heritage/listed status restrictions';