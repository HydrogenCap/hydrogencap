-- Security hardening — multiple P0/P1 RLS and function safety fixes.
--
-- Covers:
--   1. demo_requests: authenticated users could read every submission
--   2. scheduled_email_runs: INSERT / UPDATE were wide open to any auth.uid()
--   3. user_has_permission(): SECURITY DEFINER without SET search_path

-- =============================================================================
-- 1. demo_requests — lock down SELECT to service role / org owners only.
-- =============================================================================

-- Drop the permissive "authenticated can read" policy if present.
DROP POLICY IF EXISTS "Admins can view demo requests" ON public.demo_requests;
DROP POLICY IF EXISTS "Authenticated users can view demo requests" ON public.demo_requests;
DROP POLICY IF EXISTS "Users can view demo requests" ON public.demo_requests;

-- Recreate a tight SELECT policy: only platform admins (role = 'owner' in any
-- org, or with an `is_platform_admin` flag if the project uses one) can read.
-- Service role always bypasses RLS.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'demo_requests') THEN
    -- Conservative policy: no one reads via the anon/authenticated keys.
    -- Service role (edge functions / admin dashboard) can still read because
    -- it bypasses RLS.
    DROP POLICY IF EXISTS "Service role reads demo requests" ON public.demo_requests;
    CREATE POLICY "Service role reads demo requests"
      ON public.demo_requests
      FOR SELECT
      TO authenticated
      USING (false);
  END IF;
END $$;

-- =============================================================================
-- 2. scheduled_email_runs — INSERT and UPDATE must be service-role only.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'scheduled_email_runs') THEN
    -- Drop every overly permissive policy we can find.
    DROP POLICY IF EXISTS "Anyone can insert scheduled runs" ON public.scheduled_email_runs;
    DROP POLICY IF EXISTS "Admins can insert scheduled runs" ON public.scheduled_email_runs;
    DROP POLICY IF EXISTS "Authenticated can insert scheduled runs" ON public.scheduled_email_runs;
    DROP POLICY IF EXISTS "Authenticated can update scheduled runs" ON public.scheduled_email_runs;
    DROP POLICY IF EXISTS "Anyone can update scheduled runs" ON public.scheduled_email_runs;
    DROP POLICY IF EXISTS "scheduled_email_runs_insert" ON public.scheduled_email_runs;
    DROP POLICY IF EXISTS "scheduled_email_runs_update" ON public.scheduled_email_runs;

    -- Explicit deny for non-service-role writers. Edge functions using the
    -- service role bypass RLS and can still write.
    CREATE POLICY "scheduled_email_runs_no_user_insert"
      ON public.scheduled_email_runs
      FOR INSERT
      TO authenticated
      WITH CHECK (false);

    CREATE POLICY "scheduled_email_runs_no_user_update"
      ON public.scheduled_email_runs
      FOR UPDATE
      TO authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

-- =============================================================================
-- 3. user_has_permission() — add SET search_path to prevent hijack.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.user_has_permission(p_org_id UUID, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.memberships
  WHERE org_id = p_org_id AND user_id = auth.uid();

  IF v_role IS NULL THEN RETURN FALSE; END IF;

  RETURN CASE
    WHEN v_role = 'owner' THEN TRUE
    WHEN v_role = 'admin' THEN p_permission != 'delete_org'
    WHEN v_role = 'member' THEN p_permission IN ('read', 'write', 'create')
    WHEN v_role = 'accountant' THEN p_permission IN ('read', 'read_financials', 'write_financials')
    WHEN v_role = 'viewer' THEN p_permission = 'read'
    ELSE FALSE
  END;
END;
$$;

-- =============================================================================
-- 4. Helpful index on subscriptions.stripe_customer_id — Stripe webhook lookup
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
  ON public.subscriptions(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
