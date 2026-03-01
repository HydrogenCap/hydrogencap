-- Add is_demo flag to properties_v2 for identifying demo data
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- Index for quick filtering
CREATE INDEX IF NOT EXISTS idx_properties_v2_is_demo ON properties_v2(is_demo) WHERE is_demo = true;