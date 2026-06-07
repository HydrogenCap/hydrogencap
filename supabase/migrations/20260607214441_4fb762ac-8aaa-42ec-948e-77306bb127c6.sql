
CREATE TABLE IF NOT EXISTS public.oauth_states (
  nonce TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  org_id UUID NOT NULL,
  provider TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);

GRANT ALL ON public.oauth_states TO service_role;

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- No policies — service role bypasses RLS, no other roles should access.

CREATE INDEX IF NOT EXISTS oauth_states_expires_at_idx ON public.oauth_states (expires_at);
