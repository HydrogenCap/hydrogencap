-- ============================================
-- JOBS SYSTEM IMPROVEMENTS - Certificate & Follow-up Tracking
-- ============================================

-- Add certificate tracking fields to contractor_jobs
ALTER TABLE public.contractor_jobs
ADD COLUMN IF NOT EXISTS certificate_received BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS certificate_received_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS certificate_document_id UUID REFERENCES public.documents(id),
ADD COLUMN IF NOT EXISTS certificate_reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS certificate_reminder_count INTEGER DEFAULT 0;

-- Add follow-up tracking fields
ALTER TABLE public.contractor_jobs
ADD COLUMN IF NOT EXISTS follow_up_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_follow_up_date DATE,
ADD COLUMN IF NOT EXISTS response_deadline DATE;

-- Add inbox email for jobs (for future AI email inbox)
ALTER TABLE public.contractor_jobs
ADD COLUMN IF NOT EXISTS inbox_email TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS inbox_email_token TEXT UNIQUE;

-- Generate inbox email when job created
CREATE OR REPLACE FUNCTION public.generate_job_inbox_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Generate unique token
  v_token := encode(gen_random_bytes(8), 'hex');
  
  NEW.inbox_email_token := v_token;
  NEW.inbox_email := 'job-' || v_token || '@inbox.hydrogencap.app';
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists first
DROP TRIGGER IF EXISTS job_inbox_email_trigger ON public.contractor_jobs;

-- Create trigger for new jobs
CREATE TRIGGER job_inbox_email_trigger
BEFORE INSERT ON public.contractor_jobs
FOR EACH ROW
EXECUTE FUNCTION public.generate_job_inbox_email();

-- Update existing jobs with inbox emails
UPDATE public.contractor_jobs
SET 
  inbox_email_token = encode(gen_random_bytes(8), 'hex'),
  inbox_email = 'job-' || encode(gen_random_bytes(8), 'hex') || '@inbox.hydrogencap.app'
WHERE inbox_email IS NULL;

-- ============================================
-- JOB FOLLOW-UPS TABLE (for tracking communication history)
-- ============================================

CREATE TABLE IF NOT EXISTS public.job_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.contractor_jobs(id) ON DELETE CASCADE NOT NULL,
  follow_up_type TEXT CHECK (follow_up_type IN ('email', 'phone', 'sms', 'other')),
  message TEXT,
  response_received BOOLEAN DEFAULT false,
  response_text TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_follow_ups_job ON public.job_follow_ups(job_id);

ALTER TABLE public.job_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage job follow-ups"
ON public.job_follow_ups
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.contractor_jobs cj
    JOIN public.memberships m ON m.org_id = cj.org_id
    WHERE cj.id = job_follow_ups.job_id
    AND m.user_id = auth.uid()
  )
);