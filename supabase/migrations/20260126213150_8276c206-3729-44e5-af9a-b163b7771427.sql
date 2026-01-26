-- Add property lifecycle type enum and fields
-- This enables separating development properties from core rental properties
-- to prevent skewed KPIs and unnecessary compliance alerts

-- Add lifecycle type column (defaulting to 'development' for new properties)
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS lifecycle_type TEXT NOT NULL DEFAULT 'development'
CHECK (lifecycle_type IN ('development', 'core_rental'));

-- Add lifecycle status date (when lifecycle was last changed)
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS lifecycle_status_date DATE DEFAULT CURRENT_DATE;

-- Add operational date (when property becomes income-producing)
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS operational_date DATE;

-- Create an index for efficient filtering by lifecycle type
CREATE INDEX IF NOT EXISTS idx_properties_lifecycle_type ON public.properties(lifecycle_type);

-- Add a comment explaining the field
COMMENT ON COLUMN public.properties.lifecycle_type IS 'Property lifecycle stage: development (in progress/refurbishment) or core_rental (income producing). Development properties are excluded from income KPIs and compliance tracking.';
COMMENT ON COLUMN public.properties.lifecycle_status_date IS 'Date when the lifecycle_type was last changed';
COMMENT ON COLUMN public.properties.operational_date IS 'Date when property became income-producing (entered core_rental phase)';