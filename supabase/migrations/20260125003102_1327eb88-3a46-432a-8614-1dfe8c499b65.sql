-- ============================================================
-- PORTFOLIO DASHBOARD ENHANCEMENT MIGRATION
-- ============================================================

-- 1) EPC N/A FOR LISTED BUILDINGS
-- Add listed_status and epc_required to properties
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS listed_status text,
ADD COLUMN IF NOT EXISTS epc_required boolean DEFAULT true;

-- Add constraint for listed_status values
ALTER TABLE public.properties 
ADD CONSTRAINT properties_listed_status_check 
CHECK (listed_status IS NULL OR listed_status IN ('Not listed', 'Grade II', 'Grade II*', 'Grade I'));

-- 2) ADD BATHROOMS
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS bathrooms integer;

-- 3) LAND REGISTRY INFO
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS title_number text,
ADD COLUMN IF NOT EXISTS tenure text,
ADD COLUMN IF NOT EXISTS lease_years_remaining integer,
ADD COLUMN IF NOT EXISTS land_registry_link text,
ADD COLUMN IF NOT EXISTS uprn text;

-- Add constraint for tenure values  
ALTER TABLE public.properties 
ADD CONSTRAINT properties_tenure_check 
CHECK (tenure IS NULL OR tenure IN ('Freehold', 'Leasehold', 'Share of Freehold'));

-- 4) LOAN PAYMENT CALCULATION FIELDS
ALTER TABLE public.loans 
ADD COLUMN IF NOT EXISTS loan_start_date date,
ADD COLUMN IF NOT EXISTS loan_term_months integer,
ADD COLUMN IF NOT EXISTS payment_auto_calculated_gbp numeric,
ADD COLUMN IF NOT EXISTS payment_override_gbp numeric,
ADD COLUMN IF NOT EXISTS payment_source text DEFAULT 'auto';

-- Add constraint for payment_source
ALTER TABLE public.loans 
ADD CONSTRAINT loans_payment_source_check 
CHECK (payment_source IS NULL OR payment_source IN ('auto', 'manual'));

-- 5) OWNERSHIP ENTITIES TABLE
CREATE TABLE IF NOT EXISTS public.ownership_entities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  entity_type text NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT ownership_entities_type_check 
  CHECK (entity_type IN ('Person', 'Company', 'SPV', 'Investor', 'Other'))
);

-- Enable RLS on ownership_entities
ALTER TABLE public.ownership_entities ENABLE ROW LEVEL SECURITY;

-- RLS policies for ownership_entities
CREATE POLICY "Users can view ownership entities in their org"
ON public.ownership_entities FOR SELECT
USING (user_has_org_access(org_id));

CREATE POLICY "Users can insert ownership entities in their org"
ON public.ownership_entities FOR INSERT
WITH CHECK (user_has_org_access(org_id));

CREATE POLICY "Users can update ownership entities in their org"
ON public.ownership_entities FOR UPDATE
USING (user_has_org_access(org_id));

CREATE POLICY "Users can delete ownership entities in their org"
ON public.ownership_entities FOR DELETE
USING (user_has_org_access(org_id));

-- 6) PROPERTY OWNERSHIP TABLE (replaces simple ownership_entity + ownership_percent)
CREATE TABLE IF NOT EXISTS public.property_ownership (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  ownership_entity_id uuid NOT NULL REFERENCES public.ownership_entities(id) ON DELETE CASCADE,
  ownership_percent numeric NOT NULL CHECK (ownership_percent >= 0 AND ownership_percent <= 100),
  ownership_level text NOT NULL DEFAULT 'Property',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT property_ownership_level_check 
  CHECK (ownership_level IN ('Property', 'SPV_Shareholding'))
);

-- Enable RLS on property_ownership
ALTER TABLE public.property_ownership ENABLE ROW LEVEL SECURITY;

-- RLS policies for property_ownership (via property access)
CREATE POLICY "Users can view property ownership for their properties"
ON public.property_ownership FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.properties p 
  WHERE p.id = property_ownership.property_id 
  AND user_has_org_access(p.org_id)
));

CREATE POLICY "Users can insert property ownership for their properties"
ON public.property_ownership FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.properties p 
  WHERE p.id = property_ownership.property_id 
  AND user_has_org_access(p.org_id)
));

CREATE POLICY "Users can update property ownership for their properties"
ON public.property_ownership FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.properties p 
  WHERE p.id = property_ownership.property_id 
  AND user_has_org_access(p.org_id)
));

CREATE POLICY "Users can delete property ownership for their properties"
ON public.property_ownership FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.properties p 
  WHERE p.id = property_ownership.property_id 
  AND user_has_org_access(p.org_id)
));

-- Add updated_at triggers
CREATE TRIGGER update_ownership_entities_updated_at
BEFORE UPDATE ON public.ownership_entities
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_property_ownership_updated_at
BEFORE UPDATE ON public.property_ownership
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();