DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup_oauth_states') THEN
      PERFORM cron.unschedule('cleanup_oauth_states');
    END IF;
  END IF;
END
$outer$;

DROP TABLE IF EXISTS public.oauth_states;