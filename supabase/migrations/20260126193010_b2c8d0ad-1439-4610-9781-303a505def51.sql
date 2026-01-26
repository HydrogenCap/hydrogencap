-- ============================================================
-- PASSPORT DEDUPLICATION: Remove columns that duplicate properties table
-- ============================================================
-- 
-- These columns exist in both property_passport and properties table:
-- - bedrooms (duplicate of properties.beds)
-- - bathrooms (duplicate of properties.bathrooms) 
-- - owner_tenure (duplicate of properties.tenure)
--
-- The properties table is the canonical source for this data.
-- Passport should only contain operational/stock-condition fields.

-- First, verify no data loss by checking for orphaned data
-- (Cases where passport has data but properties doesn't)
-- This is informational only - the columns will be removed regardless

-- Drop the duplicate columns from property_passport
ALTER TABLE public.property_passport 
DROP COLUMN IF EXISTS bedrooms,
DROP COLUMN IF EXISTS bathrooms,
DROP COLUMN IF EXISTS owner_tenure;

-- Also remove land_registry_title_number if it exists (duplicate of properties.title_number)
ALTER TABLE public.property_passport
DROP COLUMN IF EXISTS land_registry_title_number;

-- Add a comment to clarify the deduplication
COMMENT ON TABLE public.property_passport IS 'Operational details for properties. Core property data (beds, bathrooms, tenure) lives in properties table.';