-- ============================================================
-- LEASEHOLD HEALTH MONITORING — extend leasehold_details
-- ============================================================

-- Add new columns to existing leasehold_details table
ALTER TABLE public.leasehold_details
  ADD COLUMN IF NOT EXISTS original_lease_years int,
  ADD COLUMN IF NOT EXISTS remaining_years numeric(6,1),
  ADD COLUMN IF NOT EXISTS ground_rent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ground_rent_frequency text DEFAULT 'annual'
    CHECK (ground_rent_frequency IS NULL OR ground_rent_frequency IN ('annual', 'semi_annual', 'quarterly')),
  ADD COLUMN IF NOT EXISTS ground_rent_escalation_detail text,
  ADD COLUMN IF NOT EXISTS service_charge numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charge_frequency text DEFAULT 'annual',
  ADD COLUMN IF NOT EXISTS management_company text,
  ADD COLUMN IF NOT EXISTS freeholder_name text,
  ADD COLUMN IF NOT EXISTS freeholder_contact text,
  ADD COLUMN IF NOT EXISTS lease_extension_eligible boolean,
  ADD COLUMN IF NOT EXISTS estimated_extension_cost numeric;

-- Backfill from existing columns where possible
UPDATE public.leasehold_details
SET
  original_lease_years = original_term_years,
  ground_rent = ground_rent_annual,
  service_charge = service_charge_annual,
  management_company = managing_agent
WHERE original_lease_years IS NULL;
