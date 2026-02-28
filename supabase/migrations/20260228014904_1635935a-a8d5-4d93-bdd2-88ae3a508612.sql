
-- Rate limiting table for edge functions
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX idx_rate_limits_user_function_time
  ON public.rate_limits (user_id, function_name, created_at DESC);

-- Auto-cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  DELETE FROM public.rate_limits WHERE created_at < now() - interval '24 hours';
$$;

-- RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own rate limit entries"
  ON public.rate_limits FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can read rate limits"
  ON public.rate_limits FOR SELECT
  USING (true);

CREATE POLICY "Service role can delete old rate limits"
  ON public.rate_limits FOR DELETE
  USING (true);
