-- Replay-protection store for FreeAgent OAuth state tokens
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce text UNIQUE NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_created_at ON public.oauth_states (created_at);

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

DO $outer$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'oauth_states'
      AND policyname = 'Service role manages oauth states'
  ) THEN
    CREATE POLICY "Service role manages oauth states"
      ON public.oauth_states
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$outer$;

-- Cleanup job: delete oauth_states older than 1 hour, every 15 minutes.
-- If pg_cron is ever unavailable, the block no-ops; schedule manually with:
--   SELECT cron.schedule('cleanup_oauth_states','*/15 * * * *',
--     'DELETE FROM public.oauth_states WHERE created_at < now() - interval ''1 hour''');
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup_oauth_states') THEN
      PERFORM cron.unschedule('cleanup_oauth_states');
    END IF;
    PERFORM cron.schedule(
      'cleanup_oauth_states',
      '*/15 * * * *',
      'DELETE FROM public.oauth_states WHERE created_at < now() - interval ''1 hour'''
    );
  END IF;
END
$outer$;