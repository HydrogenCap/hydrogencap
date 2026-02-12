
-- Add unique constraint to prevent duplicate rent schedule entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_rent_schedule_tenancy_due_date 
ON public.rent_schedule (tenancy_id, due_date);
