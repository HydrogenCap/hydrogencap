-- Drop client-side INSERT/SELECT that lets users tamper with their own rate-limit counters
DROP POLICY IF EXISTS "Users can insert own rate limit entries" ON public.rate_limits;
DROP POLICY IF EXISTS "Users can read own rate limits" ON public.rate_limits;

-- Replace the unsafe `current_setting('role')` policies with proper TO service_role targeting.
-- Service role bypasses RLS, but keeping explicit policies documents intent and avoids
-- the lint warning about current_setting()-based role checks.
DROP POLICY IF EXISTS "Service role can insert rate limit entries" ON public.rate_limits;
CREATE POLICY "Service role can insert rate limit entries"
  ON public.rate_limits
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can delete old rate limits" ON public.rate_limits;
CREATE POLICY "Service role can delete old rate limits"
  ON public.rate_limits
  FOR DELETE
  TO service_role
  USING (true);

-- Belt-and-braces: revoke any inherited client-side INSERT/SELECT grants.
REVOKE INSERT, SELECT, UPDATE, DELETE ON public.rate_limits FROM authenticated;
REVOKE INSERT, SELECT, UPDATE, DELETE ON public.rate_limits FROM anon;
