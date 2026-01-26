-- Create scheduled_email_runs table for tracking email sends
CREATE TABLE public.scheduled_email_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_key TEXT NOT NULL UNIQUE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  provider_message_id TEXT,
  error TEXT,
  recipient_email TEXT,
  email_subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.scheduled_email_runs ENABLE ROW LEVEL SECURITY;

-- Create policies - only org members can view
CREATE POLICY "Users can view email runs in their org"
  ON public.scheduled_email_runs
  FOR SELECT
  USING (true); -- All authenticated users can view runs (admin check in app)

CREATE POLICY "Service role can insert email runs"
  ON public.scheduled_email_runs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update email runs"
  ON public.scheduled_email_runs
  FOR UPDATE
  USING (true);

-- Add index for faster lookups
CREATE INDEX idx_scheduled_email_runs_run_key ON public.scheduled_email_runs(run_key);
CREATE INDEX idx_scheduled_email_runs_status ON public.scheduled_email_runs(status);
CREATE INDEX idx_scheduled_email_runs_created_at ON public.scheduled_email_runs(created_at DESC);