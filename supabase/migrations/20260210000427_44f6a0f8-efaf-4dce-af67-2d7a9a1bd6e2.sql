-- @allow-v1-refs: pre-cutover historical migration referencing §0a V1 tables (loans/tenancies/costs/income); baked-in DB history, not new code.

-- Add payment_reference to rent_schedule
ALTER TABLE public.rent_schedule ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- Create a unique index on payment_reference (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rent_schedule_payment_reference ON public.rent_schedule (payment_reference) WHERE payment_reference IS NOT NULL;

-- Backfill existing rows with a generated payment reference
UPDATE public.rent_schedule
SET payment_reference = 'RNT-' || UPPER(SUBSTR(id::text, 1, 8))
WHERE payment_reference IS NULL;

-- Create payment_reminders table
CREATE TABLE public.payment_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  rent_schedule_id UUID NOT NULL REFERENCES public.rent_schedule(id) ON DELETE CASCADE,
  tenancy_id UUID NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('pre_due', 'due_date', 'overdue')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_via TEXT NOT NULL DEFAULT 'email' CHECK (sent_via IN ('email', 'sms', 'both')),
  recipient_email TEXT,
  recipient_name TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'bounced')),
  resend_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_payment_reminders_schedule ON public.payment_reminders(rent_schedule_id);
CREATE INDEX idx_payment_reminders_tenancy ON public.payment_reminders(tenancy_id);
CREATE INDEX idx_payment_reminders_sent ON public.payment_reminders(sent_at DESC);

-- Enable RLS
ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies (org-based via profiles)
CREATE POLICY "Users can view payment reminders for their org"
  ON public.payment_reminders FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create payment reminders for their org"
  ON public.payment_reminders FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update payment reminders for their org"
  ON public.payment_reminders FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete payment reminders for their org"
  ON public.payment_reminders FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
