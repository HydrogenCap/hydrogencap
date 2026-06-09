ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS portfolio_view_mode text NOT NULL DEFAULT 'gross';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_portfolio_view_mode_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_portfolio_view_mode_check
  CHECK (portfolio_view_mode IN ('gross','mine'));