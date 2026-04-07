-- Safe idempotent fix for extraction_status constraint
DO $$
BEGIN
  -- Drop and recreate constraint to include new statuses
  ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_extraction_status_check;
  ALTER TABLE documents ADD CONSTRAINT documents_extraction_status_check
    CHECK (extraction_status IN (
      'pending', 'processing', 'completed', 'failed',
      'review_needed', 'rate_limited', 'credits_exhausted'
    ));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not update extraction_status constraint: %', SQLERRM;
END $$;
