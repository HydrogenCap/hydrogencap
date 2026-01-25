-- =====================================================
-- PART 1: OWNERSHIP LOOK-THROUGH MODEL
-- =====================================================

-- Rename ownership_entities to entities (keep existing data)
-- Actually, we'll keep the table name but it serves as our entities table
-- The existing ownership_entities table already has: id, org_id, name, entity_type, notes

-- Create property_legal_ownership table (who legally owns the property at title level)
CREATE TABLE public.property_legal_ownership (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_entity_id UUID NOT NULL REFERENCES public.ownership_entities(id) ON DELETE CASCADE,
  owner_percent NUMERIC NOT NULL CHECK (owner_percent >= 0 AND owner_percent <= 100),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create entity_shareholdings table (who owns shares in an entity/SPV)
CREATE TABLE public.entity_shareholdings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_entity_id UUID NOT NULL REFERENCES public.ownership_entities(id) ON DELETE CASCADE,
  shareholder_entity_id UUID NOT NULL REFERENCES public.ownership_entities(id) ON DELETE CASCADE,
  shareholder_percent NUMERIC NOT NULL CHECK (shareholder_percent >= 0 AND shareholder_percent <= 100),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Prevent self-ownership
  CONSTRAINT no_self_ownership CHECK (parent_entity_id != shareholder_entity_id)
);

-- Enable RLS on new tables
ALTER TABLE public.property_legal_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_shareholdings ENABLE ROW LEVEL SECURITY;

-- RLS policies for property_legal_ownership
CREATE POLICY "Users can view legal ownership for their properties"
ON public.property_legal_ownership FOR SELECT
USING (EXISTS (
  SELECT 1 FROM properties p
  WHERE p.id = property_legal_ownership.property_id
  AND user_has_org_access(p.org_id)
));

CREATE POLICY "Users can insert legal ownership for their properties"
ON public.property_legal_ownership FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM properties p
  WHERE p.id = property_legal_ownership.property_id
  AND user_has_org_access(p.org_id)
));

CREATE POLICY "Users can update legal ownership for their properties"
ON public.property_legal_ownership FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM properties p
  WHERE p.id = property_legal_ownership.property_id
  AND user_has_org_access(p.org_id)
));

CREATE POLICY "Users can delete legal ownership for their properties"
ON public.property_legal_ownership FOR DELETE
USING (EXISTS (
  SELECT 1 FROM properties p
  WHERE p.id = property_legal_ownership.property_id
  AND user_has_org_access(p.org_id)
));

-- RLS policies for entity_shareholdings (based on parent entity's org)
CREATE POLICY "Users can view shareholdings in their org entities"
ON public.entity_shareholdings FOR SELECT
USING (EXISTS (
  SELECT 1 FROM ownership_entities oe
  WHERE oe.id = entity_shareholdings.parent_entity_id
  AND user_has_org_access(oe.org_id)
));

CREATE POLICY "Users can insert shareholdings in their org entities"
ON public.entity_shareholdings FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM ownership_entities oe
  WHERE oe.id = entity_shareholdings.parent_entity_id
  AND user_has_org_access(oe.org_id)
));

CREATE POLICY "Users can update shareholdings in their org entities"
ON public.entity_shareholdings FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM ownership_entities oe
  WHERE oe.id = entity_shareholdings.parent_entity_id
  AND user_has_org_access(oe.org_id)
));

CREATE POLICY "Users can delete shareholdings in their org entities"
ON public.entity_shareholdings FOR DELETE
USING (EXISTS (
  SELECT 1 FROM ownership_entities oe
  WHERE oe.id = entity_shareholdings.parent_entity_id
  AND user_has_org_access(oe.org_id)
));

-- Triggers for updated_at
CREATE TRIGGER update_property_legal_ownership_updated_at
BEFORE UPDATE ON public.property_legal_ownership
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_entity_shareholdings_updated_at
BEFORE UPDATE ON public.entity_shareholdings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- PART 2: COSTS AUTO-CALCULATION RULES
-- =====================================================

-- Rename existing columns to _manual suffix and add new rule columns
ALTER TABLE public.costs 
  RENAME COLUMN management_gbp TO management_gbp_manual;

ALTER TABLE public.costs 
  RENAME COLUMN insurance_gbp TO insurance_gbp_manual;

ALTER TABLE public.costs 
  RENAME COLUMN maintenance_gbp TO repairs_gbp_manual;

-- Add rule columns for management
ALTER TABLE public.costs
  ADD COLUMN management_rule_enabled BOOLEAN DEFAULT true,
  ADD COLUMN management_rule_percent_of_rent NUMERIC DEFAULT 5.0,
  ADD COLUMN management_gbp_calculated NUMERIC;

-- Add rule columns for repairs (was maintenance)
ALTER TABLE public.costs
  ADD COLUMN repairs_rule_enabled BOOLEAN DEFAULT true,
  ADD COLUMN repairs_rule_percent_of_rent NUMERIC DEFAULT 5.0,
  ADD COLUMN repairs_gbp_calculated NUMERIC;

-- Add rule columns for insurance
ALTER TABLE public.costs
  ADD COLUMN insurance_rule_enabled BOOLEAN DEFAULT true,
  ADD COLUMN insurance_rule_percent_of_value NUMERIC DEFAULT 0.3,
  ADD COLUMN insurance_gbp_calculated NUMERIC;

-- Rename bills_gbp and other columns for consistency
ALTER TABLE public.costs
  RENAME COLUMN bills_gbp TO bills_gbp_manual;

ALTER TABLE public.costs
  RENAME COLUMN compliance_gbp TO compliance_gbp_manual;

ALTER TABLE public.costs
  RENAME COLUMN other_gbp TO other_gbp_manual;

-- Migrate data: If manual values exist, disable rules
UPDATE public.costs
SET management_rule_enabled = false
WHERE management_gbp_manual IS NOT NULL AND management_gbp_manual > 0;

UPDATE public.costs
SET repairs_rule_enabled = false
WHERE repairs_gbp_manual IS NOT NULL AND repairs_gbp_manual > 0;

UPDATE public.costs
SET insurance_rule_enabled = false
WHERE insurance_gbp_manual IS NOT NULL AND insurance_gbp_manual > 0;

-- =====================================================
-- MIGRATE OLD PROPERTY_OWNERSHIP TO NEW STRUCTURE
-- =====================================================

-- Migrate "Property" level ownership to property_legal_ownership
INSERT INTO public.property_legal_ownership (property_id, owner_entity_id, owner_percent, notes)
SELECT 
  property_id,
  ownership_entity_id,
  ownership_percent,
  notes
FROM public.property_ownership
WHERE ownership_level = 'Property';

-- Migrate "SPV_Shareholding" level to entity_shareholdings
-- This requires finding the SPV entity that owns the property
-- We'll do this by finding the legal owner entity for each property
INSERT INTO public.entity_shareholdings (parent_entity_id, shareholder_entity_id, shareholder_percent, notes)
SELECT DISTINCT
  plo.owner_entity_id as parent_entity_id,
  po.ownership_entity_id as shareholder_entity_id,
  po.ownership_percent as shareholder_percent,
  po.notes
FROM public.property_ownership po
JOIN public.property_legal_ownership plo ON plo.property_id = po.property_id
WHERE po.ownership_level = 'SPV_Shareholding'
AND plo.owner_entity_id != po.ownership_entity_id;