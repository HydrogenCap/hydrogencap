-- Fix 2: Drop empty works_orders table (duplicate of work_orders)
DROP TABLE IF EXISTS public.works_orders CASCADE;

-- Fix 3: Ensure maintenance_requests exists idempotently
-- Both migrations already ran successfully; align FK to CASCADE for consistency
DO $$
BEGIN
  -- Drop the RESTRICT FK if it exists, re-add as CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'maintenance_requests_property_v2_id_fkey'
    AND table_name = 'maintenance_requests'
  ) THEN
    ALTER TABLE public.maintenance_requests DROP CONSTRAINT maintenance_requests_property_v2_id_fkey;
    ALTER TABLE public.maintenance_requests
      ADD CONSTRAINT maintenance_requests_property_v2_id_fkey
      FOREIGN KEY (property_v2_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Fix 5: Lock down rate_limits policies
-- Drop permissive DELETE policy
DROP POLICY IF EXISTS "Service role can delete old rate limits" ON public.rate_limits;
-- Recreate restricted to service_role
CREATE POLICY "Service role can delete old rate limits"
  ON public.rate_limits FOR DELETE
  USING (current_setting('role') = 'service_role');

-- Drop permissive SELECT policy
DROP POLICY IF EXISTS "Service role can read rate limits" ON public.rate_limits;
-- Recreate restricted to service_role
CREATE POLICY "Service role can read rate limits"
  ON public.rate_limits FOR SELECT
  USING (current_setting('role') = 'service_role');

-- Drop permissive INSERT policy
DROP POLICY IF EXISTS "Users can insert own rate limit entries" ON public.rate_limits;
-- Recreate restricted to service_role
CREATE POLICY "Service role can insert rate limit entries"
  ON public.rate_limits FOR INSERT
  WITH CHECK (current_setting('role') = 'service_role');