
-- Phase 1: Add missing columns to properties_v2 for V1 hook migration

-- Geocoding fields (used by useGeocoding.ts)
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS place_id TEXT;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS formatted_address TEXT;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS geocode_source TEXT;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS geocode_status TEXT DEFAULT 'NOT_STARTED';
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS geocode_confidence TEXT;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS geocode_error TEXT;

-- Beneficial ownership override (used by useBeneficialGroups.ts)
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS beneficial_override_percent NUMERIC;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS beneficial_override_notes TEXT;

-- Identity fields (used by useCoreIdentity.ts, usePassportPageData.ts)
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS uprn TEXT;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS planning_authority TEXT;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS listed_status TEXT;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS conservation_area BOOLEAN DEFAULT false;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS property_name TEXT;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS identity_updated_at TIMESTAMPTZ;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS identity_updated_by UUID;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS title_number TEXT;

-- Compliance feature fields (used by useComplianceRequirements.ts)
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS asset_category TEXT;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS occupancy_status TEXT;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS is_hmo_licensed BOOLEAN;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS selective_licence_required BOOLEAN;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS co_alarm_required BOOLEAN;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS epc_required BOOLEAN;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS has_emergency_lighting BOOLEAN;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS fire_alarm_grade TEXT;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS has_solar BOOLEAN;

-- Lifecycle fields (used by useGoLiveChecklist.ts, useBulkPropertyUpdate.ts)
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS operational_date DATE;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS lifecycle_status_date TIMESTAMPTZ;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS tenure TEXT;

-- Legacy compat fields (used by useGoLiveChecklist.ts validation)
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS legal_owner_company_id UUID REFERENCES companies(id);
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS legal_owner_party_id UUID REFERENCES parties(id);

-- Backfill data from V1 to V2 (matching by address + postcode + org)
UPDATE properties_v2 pv2
SET 
  place_id = COALESCE(pv2.place_id, p.place_id),
  formatted_address = COALESCE(pv2.formatted_address, p.formatted_address),
  geocoded_at = COALESCE(pv2.geocoded_at, p.geocoded_at),
  geocode_source = COALESCE(pv2.geocode_source, p.geocode_source),
  geocode_status = COALESCE(pv2.geocode_status, p.geocode_status),
  geocode_confidence = COALESCE(pv2.geocode_confidence, p.geocode_confidence),
  geocode_error = COALESCE(pv2.geocode_error, p.geocode_error),
  beneficial_override_percent = COALESCE(pv2.beneficial_override_percent, p.beneficial_override_percent),
  beneficial_override_notes = COALESCE(pv2.beneficial_override_notes, p.beneficial_override_notes),
  uprn = COALESCE(pv2.uprn, p.uprn),
  planning_authority = COALESCE(pv2.planning_authority, p.planning_authority),
  listed_status = COALESCE(pv2.listed_status, p.listed_status),
  conservation_area = COALESCE(pv2.conservation_area, p.conservation_area),
  property_name = COALESCE(pv2.property_name, p.property_name),
  identity_updated_at = COALESCE(pv2.identity_updated_at, p.identity_updated_at),
  identity_updated_by = COALESCE(pv2.identity_updated_by, p.identity_updated_by),
  title_number = COALESCE(pv2.title_number, p.title_number),
  asset_category = COALESCE(pv2.asset_category, p.asset_category),
  occupancy_status = COALESCE(pv2.occupancy_status, p.occupancy_status),
  is_hmo_licensed = COALESCE(pv2.is_hmo_licensed, p.is_hmo_licensed),
  selective_licence_required = COALESCE(pv2.selective_licence_required, p.selective_licence_required),
  co_alarm_required = COALESCE(pv2.co_alarm_required, p.co_alarm_required),
  epc_required = COALESCE(pv2.epc_required, p.epc_required),
  has_emergency_lighting = COALESCE(pv2.has_emergency_lighting, p.has_emergency_lighting),
  fire_alarm_grade = COALESCE(pv2.fire_alarm_grade, p.fire_alarm_grade),
  has_solar = COALESCE(pv2.has_solar, p.has_solar),
  operational_date = COALESCE(pv2.operational_date, p.operational_date::date),
  lifecycle_status_date = COALESCE(pv2.lifecycle_status_date, p.lifecycle_status_date),
  tenure = COALESCE(pv2.tenure, p.tenure),
  legal_owner_company_id = COALESCE(pv2.legal_owner_company_id, p.legal_owner_company_id),
  legal_owner_party_id = COALESCE(pv2.legal_owner_party_id, p.legal_owner_party_id)
FROM properties p
WHERE pv2.org_id = p.org_id
  AND LOWER(TRIM(pv2.postcode)) = LOWER(TRIM(p.postcode))
  AND LOWER(TRIM(pv2.address_line_1)) = LOWER(TRIM(p.address_line));
