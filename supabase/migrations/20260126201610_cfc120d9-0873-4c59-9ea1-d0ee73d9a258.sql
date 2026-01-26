-- Add property feature columns to drive intelligent compliance requirements
-- These columns determine which compliance items are required for each property

ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS has_gas boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS has_fire_alarm_system boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS fire_alarm_grade text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS has_emergency_lighting boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS asset_category text DEFAULT 'Single Let',
ADD COLUMN IF NOT EXISTS occupancy_status text DEFAULT 'Occupied',
ADD COLUMN IF NOT EXISTS is_hmo_licensed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS selective_licence_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS co_alarm_required boolean DEFAULT true;

-- Add comments for clarity
COMMENT ON COLUMN public.properties.has_gas IS 'Whether property has gas supply - determines if Gas Safety Certificate required';
COMMENT ON COLUMN public.properties.has_fire_alarm_system IS 'Whether property has integrated fire alarm system (Grade A/D)';
COMMENT ON COLUMN public.properties.fire_alarm_grade IS 'Fire alarm grade: Grade A, Grade D1, Grade D2, None';
COMMENT ON COLUMN public.properties.has_emergency_lighting IS 'Whether property has emergency lighting system';
COMMENT ON COLUMN public.properties.asset_category IS 'Property type: Single Let, HMO, HMO (Licensed), Commercial';
COMMENT ON COLUMN public.properties.occupancy_status IS 'Occupancy status: Occupied, Void, In Works';
COMMENT ON COLUMN public.properties.is_hmo_licensed IS 'Whether property requires HMO licence';
COMMENT ON COLUMN public.properties.selective_licence_required IS 'Whether property is in selective licensing area';
COMMENT ON COLUMN public.properties.co_alarm_required IS 'Whether CO alarm is required (gas or solid fuel)';

-- Add is_required and is_manually_excluded columns to compliance_items for override capability
ALTER TABLE public.compliance_items
ADD COLUMN IF NOT EXISTS is_required boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS is_manually_excluded boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS exclusion_reason text DEFAULT NULL;