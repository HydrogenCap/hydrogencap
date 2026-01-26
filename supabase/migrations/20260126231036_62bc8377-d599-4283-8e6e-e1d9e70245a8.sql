-- Add 'go_live' entry type to the activity_log check constraint
ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_entry_type_check;

ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_entry_type_check 
CHECK (entry_type IN (
  'property_created',
  'property_updated', 
  'valuation_changed',
  'mortgage_updated',
  'rate_changed',
  'income_updated',
  'costs_updated',
  'document_uploaded',
  'document_accepted',
  'note_added',
  'manual',
  'go_live'
));