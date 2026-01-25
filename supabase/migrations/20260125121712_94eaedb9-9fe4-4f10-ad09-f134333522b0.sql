-- Add geocoding status and source tracking fields
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS geocode_status text DEFAULT 'NOT_STARTED' CHECK (geocode_status IN ('NOT_STARTED', 'SUCCESS', 'PARTIAL', 'FAILED')),
ADD COLUMN IF NOT EXISTS geocode_source text CHECK (geocode_source IS NULL OR geocode_source IN ('PLACES', 'GEOCODE')),
ADD COLUMN IF NOT EXISTS geocode_error text;

-- Add index for geocode_status to speed up backfill queries
CREATE INDEX IF NOT EXISTS idx_properties_geocode_status ON public.properties(geocode_status);

-- Update existing properties with coordinates to mark as SUCCESS
UPDATE public.properties 
SET geocode_status = 'SUCCESS', geocode_source = 'GEOCODE'
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND geocode_status IS NULL;

-- Comment on the columns
COMMENT ON COLUMN public.properties.geocode_status IS 'Geocoding status: NOT_STARTED, SUCCESS, PARTIAL, FAILED';
COMMENT ON COLUMN public.properties.geocode_source IS 'Source of geocode: PLACES (autocomplete) or GEOCODE (API fallback)';
COMMENT ON COLUMN public.properties.geocode_error IS 'Error message if geocoding failed';