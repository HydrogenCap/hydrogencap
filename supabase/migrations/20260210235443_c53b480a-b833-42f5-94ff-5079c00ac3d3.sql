-- Add columns to store AI-extracted certifier information
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS extracted_certifier_name text,
ADD COLUMN IF NOT EXISTS extracted_certifier_company text;