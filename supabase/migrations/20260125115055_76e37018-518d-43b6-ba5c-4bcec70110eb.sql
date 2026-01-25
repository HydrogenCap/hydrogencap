-- Add oil heating fields to property_passport
ALTER TABLE public.property_passport
ADD COLUMN IF NOT EXISTS has_gas_supply boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS oil_tank_location text,
ADD COLUMN IF NOT EXISTS oil_supplier text,
ADD COLUMN IF NOT EXISTS oil_tank_capacity_litres integer;

-- Add comment for clarity
COMMENT ON COLUMN public.property_passport.has_gas_supply IS 'Whether the property has mains gas supply';
COMMENT ON COLUMN public.property_passport.oil_tank_location IS 'Location of oil tank for oil-heated properties';
COMMENT ON COLUMN public.property_passport.oil_supplier IS 'Oil supplier name';
COMMENT ON COLUMN public.property_passport.oil_tank_capacity_litres IS 'Oil tank capacity in litres';