-- Create insurance_policies table to store policy details per property
CREATE TABLE public.insurance_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  insurer_name TEXT,
  policy_number TEXT,
  renewal_date DATE,
  cover_type TEXT, -- Buildings, Landlord, HMO, Contents, Other
  premium_gbp DECIMAL(10,2),
  excess_gbp DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id) -- One policy record per property for now
);

-- Enable RLS
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;

-- RLS policies using the org access pattern
CREATE POLICY "Users can view insurance for org properties"
  ON public.insurance_policies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      JOIN public.memberships m ON m.org_id = p.org_id
      WHERE p.id = insurance_policies.property_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert insurance for org properties"
  ON public.insurance_policies FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      JOIN public.memberships m ON m.org_id = p.org_id
      WHERE p.id = insurance_policies.property_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update insurance for org properties"
  ON public.insurance_policies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      JOIN public.memberships m ON m.org_id = p.org_id
      WHERE p.id = insurance_policies.property_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete insurance for org properties"
  ON public.insurance_policies FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      JOIN public.memberships m ON m.org_id = p.org_id
      WHERE p.id = insurance_policies.property_id
        AND m.user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_insurance_policies_updated_at
  BEFORE UPDATE ON public.insurance_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();