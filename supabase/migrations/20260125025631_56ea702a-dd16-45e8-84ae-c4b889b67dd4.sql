-- Create beneficial_groups table
CREATE TABLE public.beneficial_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create entity_beneficial_mapping table
CREATE TABLE public.entity_beneficial_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES public.ownership_entities(id) ON DELETE CASCADE,
  beneficial_group_id UUID NOT NULL REFERENCES public.beneficial_groups(id) ON DELETE CASCADE,
  effective_from DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Prevent duplicate mappings
  CONSTRAINT unique_entity_group_mapping UNIQUE (entity_id, beneficial_group_id)
);

-- Add property-level override for attributable ownership
ALTER TABLE public.properties
ADD COLUMN beneficial_override_percent NUMERIC CHECK (beneficial_override_percent >= 0 AND beneficial_override_percent <= 100),
ADD COLUMN beneficial_override_notes TEXT;

-- Enable RLS on beneficial_groups
ALTER TABLE public.beneficial_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies for beneficial_groups
CREATE POLICY "Users can view beneficial groups in their org"
ON public.beneficial_groups FOR SELECT
USING (user_has_org_access(org_id));

CREATE POLICY "Users can insert beneficial groups in their org"
ON public.beneficial_groups FOR INSERT
WITH CHECK (user_has_org_access(org_id));

CREATE POLICY "Users can update beneficial groups in their org"
ON public.beneficial_groups FOR UPDATE
USING (user_has_org_access(org_id));

CREATE POLICY "Users can delete beneficial groups in their org"
ON public.beneficial_groups FOR DELETE
USING (user_has_org_access(org_id));

-- Enable RLS on entity_beneficial_mapping
ALTER TABLE public.entity_beneficial_mapping ENABLE ROW LEVEL SECURITY;

-- RLS policies for entity_beneficial_mapping (via entity's org)
CREATE POLICY "Users can view entity mappings in their org"
ON public.entity_beneficial_mapping FOR SELECT
USING (EXISTS (
  SELECT 1 FROM ownership_entities oe
  WHERE oe.id = entity_beneficial_mapping.entity_id
  AND user_has_org_access(oe.org_id)
));

CREATE POLICY "Users can insert entity mappings in their org"
ON public.entity_beneficial_mapping FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM ownership_entities oe
  WHERE oe.id = entity_beneficial_mapping.entity_id
  AND user_has_org_access(oe.org_id)
));

CREATE POLICY "Users can update entity mappings in their org"
ON public.entity_beneficial_mapping FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM ownership_entities oe
  WHERE oe.id = entity_beneficial_mapping.entity_id
  AND user_has_org_access(oe.org_id)
));

CREATE POLICY "Users can delete entity mappings in their org"
ON public.entity_beneficial_mapping FOR DELETE
USING (EXISTS (
  SELECT 1 FROM ownership_entities oe
  WHERE oe.id = entity_beneficial_mapping.entity_id
  AND user_has_org_access(oe.org_id)
));