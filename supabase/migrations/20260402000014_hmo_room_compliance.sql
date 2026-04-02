-- HMO Room Compliance: add size and amenity tracking to rooms_v2
-- Supports UK HMO minimum room size regulations (The Licensing of Houses in Multiple Occupation Order 2018)

-- Room size in square metres
ALTER TABLE rooms_v2
  ADD COLUMN IF NOT EXISTS size_sqm numeric;

-- Occupancy type for HMO compliance (single adult, double/couple, child under 10)
ALTER TABLE rooms_v2
  ADD COLUMN IF NOT EXISTS occupancy_type text
    CHECK (occupancy_type IN ('single', 'double', 'child'))
    DEFAULT NULL;

-- Amenity type categorisation for amenity ratio calculations
ALTER TABLE rooms_v2
  ADD COLUMN IF NOT EXISTS amenity_type text
    CHECK (amenity_type IN ('bedroom', 'bathroom', 'kitchen', 'toilet', 'common'))
    DEFAULT NULL;
