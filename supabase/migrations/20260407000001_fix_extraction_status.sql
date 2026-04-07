-- Fix extraction_status CHECK constraint to include rate_limited and credits_exhausted.
-- The edge function (process-document) sets these statuses on 429/402 responses,
-- but the original constraint rejected them, leaving documents stuck on 'pending'.

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_extraction_status_check;
ALTER TABLE documents ADD CONSTRAINT documents_extraction_status_check
  CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed', 'review_needed', 'rate_limited', 'credits_exhausted'));
