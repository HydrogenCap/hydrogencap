-- Add Google Maps address fields to properties table
-- Note: latitude, longitude, postcode, address_line already exist - adding new fields

-- Add place_id for Google Places identification
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS place_id TEXT;

-- Add formatted address from Google
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS formatted_address TEXT;

-- Add structured address components
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS address_line2 TEXT;

ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS town_city TEXT;

ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS county TEXT;

ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'United Kingdom';

-- Add geocoding metadata
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS geocode_confidence TEXT CHECK (geocode_confidence IN ('exact', 'approximate', 'unknown'));

ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMP WITH TIME ZONE;

-- Create index for place_id lookups (for duplicate detection)
CREATE INDEX IF NOT EXISTS idx_properties_place_id ON public.properties(place_id) WHERE place_id IS NOT NULL;

-- Create spatial index for proximity searches (using lat/lng)
CREATE INDEX IF NOT EXISTS idx_properties_location ON public.properties(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create index for postcode searches
CREATE INDEX IF NOT EXISTS idx_properties_postcode ON public.properties(postcode) WHERE postcode IS NOT NULL;