-- Add bad_debt to rent_status enum
ALTER TYPE rent_status ADD VALUE IF NOT EXISTS 'bad_debt';

-- Add tags column to rent_schedule for filtering
ALTER TABLE public.rent_schedule ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
