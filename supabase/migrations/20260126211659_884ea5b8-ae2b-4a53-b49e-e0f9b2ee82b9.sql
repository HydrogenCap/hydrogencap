-- Fix RLS policies to be more restrictive
DROP POLICY IF EXISTS "Service role can insert email runs" ON public.scheduled_email_runs;
DROP POLICY IF EXISTS "Service role can update email runs" ON public.scheduled_email_runs;

-- Only authenticated users can view (SELECT policy with true is fine for read access)
-- INSERT and UPDATE will be done by service role which bypasses RLS