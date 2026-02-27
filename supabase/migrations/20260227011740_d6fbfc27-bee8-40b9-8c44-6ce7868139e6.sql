-- Add balance sheet snapshot fields to financial_snapshots
-- These enable point-in-time portfolio valuation, debt, and equity tracking

ALTER TABLE public.financial_snapshots
  ADD COLUMN IF NOT EXISTS valuation_at_snapshot numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS debt_at_snapshot numeric DEFAULT NULL;

-- Add a computed equity column via a generated column
-- equity = valuation - debt
ALTER TABLE public.financial_snapshots
  ADD COLUMN IF NOT EXISTS equity_at_snapshot numeric 
  GENERATED ALWAYS AS (
    COALESCE(valuation_at_snapshot, 0) - COALESCE(debt_at_snapshot, 0)
  ) STORED;

-- Add a computed LTV column
ALTER TABLE public.financial_snapshots
  ADD COLUMN IF NOT EXISTS ltv_at_snapshot numeric 
  GENERATED ALWAYS AS (
    CASE 
      WHEN COALESCE(valuation_at_snapshot, 0) > 0 
      THEN round((COALESCE(debt_at_snapshot, 0) / valuation_at_snapshot * 100)::numeric, 2)
      ELSE NULL 
    END
  ) STORED;

COMMENT ON COLUMN public.financial_snapshots.valuation_at_snapshot IS 'Property valuation at the time of this snapshot';
COMMENT ON COLUMN public.financial_snapshots.debt_at_snapshot IS 'Total outstanding debt at the time of this snapshot';
COMMENT ON COLUMN public.financial_snapshots.equity_at_snapshot IS 'Computed: valuation minus debt at snapshot time';
COMMENT ON COLUMN public.financial_snapshots.ltv_at_snapshot IS 'Computed: debt / valuation * 100 at snapshot time';