-- Unstick documents that have been pending/processing for more than 10 minutes.
-- These are the result of process-document-v2 never being deployed and failing
-- without writing a failure status back to the documents table.
UPDATE public.documents
SET extraction_status = 'failed',
    validation_errors = ARRAY['Document processing failed — reset by migration 20260409000001']
WHERE extraction_status IN ('pending', 'processing')
  AND created_at < now() - interval '10 minutes';
