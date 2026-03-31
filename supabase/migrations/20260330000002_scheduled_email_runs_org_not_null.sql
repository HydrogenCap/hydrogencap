-- org_id was added as nullable in 20260320011622 but is required for RLS
-- to work correctly. Rows with NULL org_id fail all RLS checks silently
-- (NULL not in set due to three-valued logic), making them invisible to
-- all users. Enforce NOT NULL at the DB level.
--
-- The column is already populated by the trigger/webhook that creates rows,
-- so no backfill is expected. The DO block below is a safety net for any
-- orphaned rows that might exist in non-production environments.

DO $$
BEGIN
  -- Delete orphaned rows with no org_id that can never be accessed anyway
  DELETE FROM public.scheduled_email_runs WHERE org_id IS NULL;

  -- Enforce NOT NULL
  ALTER TABLE public.scheduled_email_runs
    ALTER COLUMN org_id SET NOT NULL;
END $$;
