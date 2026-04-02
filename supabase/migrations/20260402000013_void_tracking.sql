-- ============================================================
-- VOID TRACKING ENHANCEMENTS
-- Adds cost modelling columns and new void reasons
-- ============================================================

-- Add new columns for cost modelling
ALTER TABLE public.void_periods
  ADD COLUMN IF NOT EXISTS actual_costs NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lost_rent NUMERIC,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Expand reason enum to include maintenance and market_conditions
-- Drop old check constraint and recreate with expanded values
ALTER TABLE public.void_periods DROP CONSTRAINT IF EXISTS void_periods_reason_check;
ALTER TABLE public.void_periods
  ADD CONSTRAINT void_periods_reason_check
  CHECK (reason IN ('between_tenants', 'refurbishment', 'market_conditions', 'legal_dispute', 'maintenance', 'sale_preparation', 'other'));

-- Index for active voids per org (partial index for fast dashboard queries)
CREATE INDEX IF NOT EXISTS idx_void_periods_active
  ON public.void_periods(org_id)
  WHERE end_date IS NULL;
