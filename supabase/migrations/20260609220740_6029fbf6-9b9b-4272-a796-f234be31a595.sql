-- Demo requests abuse controls
-- The existing "Anyone can submit demo requests" RLS policy stays intact —
-- the marketing lead-capture form must remain unauthenticated.
-- These controls add defense-in-depth on top of that intentional public INSERT.

-- 1. Email format validation (server-side, in addition to client-side Zod check)
ALTER TABLE public.demo_requests
  ADD CONSTRAINT demo_requests_email_format_chk
  CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$');

-- 2. Email-based rate limit: max 5 submissions per email per rolling hour.
--    IP-based rate limiting is enforced in the submit-demo-request edge function
--    (the database does not see the caller's IP).
CREATE OR REPLACE FUNCTION public.enforce_demo_request_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.demo_requests
  WHERE lower(email) = lower(NEW.email)
    AND created_at > now() - INTERVAL '1 hour';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'demo_request_rate_limit_exceeded: more than 5 submissions for this email in the past hour'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_demo_request_rate_limit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER demo_requests_rate_limit_trg
  BEFORE INSERT ON public.demo_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_demo_request_rate_limit();

-- Index to keep the per-email rate-limit lookup cheap.
CREATE INDEX IF NOT EXISTS demo_requests_email_created_at_idx
  ON public.demo_requests (lower(email), created_at DESC);