-- Convert flagged views to SECURITY INVOKER so RLS is evaluated against the caller.
-- Idempotent: ALTER VIEW ... SET (security_invoker = on) is safe to re-run.
DO $$
DECLARE
  v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'investor_commitment_detail',
    'investor_portfolio_summary',
    'investor_return_metrics',
    'portfolio_monthly_summary'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_views
      WHERE schemaname = 'public' AND viewname = v
    ) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v);
    END IF;
  END LOOP;
END $$;