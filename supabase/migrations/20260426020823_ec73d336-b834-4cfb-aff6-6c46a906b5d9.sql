-- 1. Add columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_seen_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS portfolio_size_band text NULL;

-- 2. Constrain portfolio_size_band values
DO $outer$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_portfolio_size_band_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_portfolio_size_band_check
      CHECK (portfolio_size_band IS NULL OR portfolio_size_band IN ('1','2-5','6-20','21+'));
  END IF;
END
$outer$;

-- 3. Backfill: any user who already owns/manages at least one property in any
-- of their orgs gets welcome_seen_at = now() so the overlay never appears.
UPDATE public.profiles p
SET welcome_seen_at = now()
WHERE welcome_seen_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.properties_v2 pv2 ON pv2.org_id = m.org_id
    WHERE m.user_id = p.user_id
  );

-- 4. RLS: an "Users can update own profile" policy already exists (USING auth.uid() = user_id),
-- which covers both new columns. Add a defensive CHECK clause if missing.
DO $outer$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'Users can update own profile'
  ) THEN
    -- Recreate with both USING and WITH CHECK to prevent users from changing
    -- another user's row via UPDATE ... WHERE id = '...' attacks.
    DROP POLICY "Users can update own profile" ON public.profiles;
    CREATE POLICY "Users can update own profile"
      ON public.profiles
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$outer$;