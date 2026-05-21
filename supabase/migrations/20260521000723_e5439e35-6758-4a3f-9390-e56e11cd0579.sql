CREATE TABLE IF NOT EXISTS public.errors_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  user_id UUID,
  source TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  context JSONB,
  stack TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_errors_log_org_created ON public.errors_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_errors_log_source ON public.errors_log(source);
CREATE INDEX IF NOT EXISTS idx_errors_log_unresolved ON public.errors_log(org_id, resolved) WHERE resolved = false;

ALTER TABLE public.errors_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their org errors"
  ON public.errors_log FOR SELECT
  USING (org_id IS NOT NULL AND public.user_has_org_access(org_id));

CREATE POLICY "Authenticated users can insert errors for their org"
  ON public.errors_log FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (org_id IS NULL OR public.user_has_org_access(org_id))
  );

CREATE POLICY "Org members can update their org errors"
  ON public.errors_log FOR UPDATE
  USING (org_id IS NOT NULL AND public.user_has_org_access(org_id));
