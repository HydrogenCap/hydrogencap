-- Create local_authorities table
CREATE TABLE public.local_authorities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Enable RLS
ALTER TABLE public.local_authorities ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their org's local authorities"
ON public.local_authorities FOR SELECT
USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can create local authorities in their org"
ON public.local_authorities FOR INSERT
WITH CHECK (org_id = public.get_user_org_id());

CREATE POLICY "Users can update their org's local authorities"
ON public.local_authorities FOR UPDATE
USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can delete their org's local authorities"
ON public.local_authorities FOR DELETE
USING (public.user_has_org_access(org_id));

-- Create management_companies table
CREATE TABLE public.management_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Enable RLS
ALTER TABLE public.management_companies ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their org's management companies"
ON public.management_companies FOR SELECT
USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can create management companies in their org"
ON public.management_companies FOR INSERT
WITH CHECK (org_id = public.get_user_org_id());

CREATE POLICY "Users can update their org's management companies"
ON public.management_companies FOR UPDATE
USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can delete their org's management companies"
ON public.management_companies FOR DELETE
USING (public.user_has_org_access(org_id));

-- Update property_passport with FK columns
ALTER TABLE public.property_passport
ADD COLUMN local_authority_id UUID REFERENCES public.local_authorities(id) ON DELETE SET NULL,
ADD COLUMN local_authority_text TEXT,
ADD COLUMN management_company_id UUID REFERENCES public.management_companies(id) ON DELETE SET NULL,
ADD COLUMN management_company_text TEXT;

-- Add term_years to loans table for repayment calculation
ALTER TABLE public.loans
ADD COLUMN term_years INTEGER;