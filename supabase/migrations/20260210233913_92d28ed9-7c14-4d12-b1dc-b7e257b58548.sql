
-- Deprecate address fields on property_passport (keep but stop writing)
COMMENT ON COLUMN property_passport.town_city IS 'DEPRECATED — use properties.town_city instead';
COMMENT ON COLUMN property_passport.county IS 'DEPRECATED — use properties.county instead';
COMMENT ON COLUMN property_passport.postcode IS 'DEPRECATED — use properties.postcode instead';

-- Drop duplicated columns from properties table
-- construction_type is now solely on property_passport
ALTER TABLE properties DROP COLUMN IF EXISTS construction_type;
-- year_built is replaced by built_in_year (integer) on property_passport
ALTER TABLE properties DROP COLUMN IF EXISTS year_built;
