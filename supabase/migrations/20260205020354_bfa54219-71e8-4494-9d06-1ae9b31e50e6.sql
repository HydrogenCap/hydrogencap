-- Fix scheduled_email_runs RLS: Add org_id column and proper access control

-- Add org_id column to scheduled_email_runs
ALTER TABLE public.scheduled_email_runs 
ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view email runs in their org" ON public.scheduled_email_runs;

-- Create a proper policy that checks organization membership
CREATE POLICY "Users can view email runs in their org"
ON public.scheduled_email_runs
FOR SELECT
USING (
  org_id IS NOT NULL AND user_has_org_access(org_id)
);

-- Allow system/service to insert email runs (for edge functions)
CREATE POLICY "Service can insert email runs"
ON public.scheduled_email_runs
FOR INSERT
WITH CHECK (true);

-- Allow system/service to update email runs
CREATE POLICY "Service can update email runs"
ON public.scheduled_email_runs
FOR UPDATE
USING (true);