-- P1-1: Fix rate_limits SELECT policy — stop leaking usage metadata cross-org
DROP POLICY IF EXISTS "Service role can read rate limits" ON public.rate_limits;
CREATE POLICY "Users can read own rate limits" ON public.rate_limits FOR SELECT USING (user_id = auth.uid());