-- Create enum types for source and status
CREATE TYPE public.autofill_source_type AS ENUM (
  'postcode_lookup',
  'epc',
  'floorplan',
  'listing',
  'inventory',
  'photo',
  'default'
);

CREATE TYPE public.autofill_suggestion_status AS ENUM (
  'pending',
  'accepted',
  'rejected'
);

CREATE TYPE public.passport_change_reason AS ENUM (
  'ai_accept',
  'manual_edit'
);

-- Create passport_autofill_suggestions table
CREATE TABLE public.passport_autofill_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  suggested_value JSONB NOT NULL,
  confidence NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source_type public.autofill_source_type NOT NULL,
  source_ref TEXT,
  evidence_excerpt TEXT,
  status public.autofill_suggestion_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID
);

-- Create passport_field_audit table
CREATE TABLE public.passport_field_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  change_reason public.passport_change_reason NOT NULL,
  source_type public.autofill_source_type,
  source_ref TEXT,
  confidence NUMERIC(3,2)
);

-- Enable RLS on both tables
ALTER TABLE public.passport_autofill_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_field_audit ENABLE ROW LEVEL SECURITY;

-- RLS policies for passport_autofill_suggestions
CREATE POLICY "Users can view suggestions for their org properties"
ON public.passport_autofill_suggestions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = passport_autofill_suggestions.property_id
    AND user_has_org_access(p.org_id)
  )
);

CREATE POLICY "Users can insert suggestions for their org properties"
ON public.passport_autofill_suggestions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = passport_autofill_suggestions.property_id
    AND user_has_org_access(p.org_id)
  )
);

CREATE POLICY "Users can update suggestions for their org properties"
ON public.passport_autofill_suggestions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = passport_autofill_suggestions.property_id
    AND user_has_org_access(p.org_id)
  )
);

CREATE POLICY "Users can delete suggestions for their org properties"
ON public.passport_autofill_suggestions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = passport_autofill_suggestions.property_id
    AND user_has_org_access(p.org_id)
  )
);

-- RLS policies for passport_field_audit
CREATE POLICY "Users can view audit for their org properties"
ON public.passport_field_audit
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = passport_field_audit.property_id
    AND user_has_org_access(p.org_id)
  )
);

CREATE POLICY "Users can insert audit for their org properties"
ON public.passport_field_audit
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = passport_field_audit.property_id
    AND user_has_org_access(p.org_id)
  )
);

-- Create indexes for performance
CREATE INDEX idx_autofill_suggestions_property ON public.passport_autofill_suggestions(property_id);
CREATE INDEX idx_autofill_suggestions_status ON public.passport_autofill_suggestions(status);
CREATE INDEX idx_field_audit_property ON public.passport_field_audit(property_id);
CREATE INDEX idx_field_audit_changed_at ON public.passport_field_audit(changed_at DESC);