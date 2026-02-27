
-- Add reconciliation status and matching columns to bank_transactions
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'unmatched',
  ADD COLUMN IF NOT EXISTS matched_schedule_id UUID REFERENCES public.rent_schedule(id),
  ADD COLUMN IF NOT EXISTS matched_payment_id UUID REFERENCES public.rent_payments(id),
  ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS matched_by UUID,
  ADD COLUMN IF NOT EXISTS import_hash TEXT;

-- Validation trigger for status values (instead of CHECK constraint)
CREATE OR REPLACE FUNCTION public.validate_bank_transaction_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('unmatched', 'suggested', 'matched', 'excluded', 'non_rent') THEN
    RAISE EXCEPTION 'Invalid bank transaction status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_bank_txn_status
  BEFORE INSERT OR UPDATE ON public.bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_bank_transaction_status();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bank_txn_status ON public.bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bank_txn_hash ON public.bank_transactions(import_hash);
CREATE INDEX IF NOT EXISTS idx_bank_txn_matched_schedule ON public.bank_transactions(matched_schedule_id);

-- Backfill: Migrate is_reconciled=true to status='matched'
UPDATE public.bank_transactions
SET status = 'matched'
WHERE is_reconciled = true;
