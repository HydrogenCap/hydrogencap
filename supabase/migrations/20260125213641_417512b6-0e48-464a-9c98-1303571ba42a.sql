-- Drop the existing constraint
ALTER TABLE public.activity_log DROP CONSTRAINT activity_log_entry_type_check;

-- Add new constraint with all the entry types used in the code
ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_entry_type_check 
CHECK (entry_type = ANY (ARRAY[
  'property_created'::text, 
  'property_updated'::text, 
  'valuation_changed'::text, 
  'mortgage_updated'::text, 
  'rate_changed'::text, 
  'income_updated'::text, 
  'costs_updated'::text, 
  'document_uploaded'::text, 
  'document_accepted'::text, 
  'note_added'::text, 
  'manual'::text,
  -- Keep legacy values for backwards compatibility
  'valuation'::text, 
  'rate'::text, 
  'rent'::text, 
  'works'::text, 
  'refinance'::text, 
  'document'::text, 
  'note'::text, 
  'system'::text
]));