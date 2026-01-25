-- Create table to track dismissed duplicates
CREATE TABLE public.dismissed_duplicates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  property_id_1 UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  property_id_2 UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  dismissed_by UUID NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT,
  
  -- Ensure we don't have duplicate dismissals (order-independent)
  UNIQUE (org_id, property_id_1, property_id_2)
);

-- Enable RLS
ALTER TABLE public.dismissed_duplicates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view dismissed duplicates for their org"
ON public.dismissed_duplicates
FOR SELECT
USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert dismissed duplicates for their org"
ON public.dismissed_duplicates
FOR INSERT
WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete dismissed duplicates for their org"
ON public.dismissed_duplicates
FOR DELETE
USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_dismissed_duplicates_properties ON public.dismissed_duplicates(property_id_1, property_id_2);
CREATE INDEX idx_dismissed_duplicates_org ON public.dismissed_duplicates(org_id);