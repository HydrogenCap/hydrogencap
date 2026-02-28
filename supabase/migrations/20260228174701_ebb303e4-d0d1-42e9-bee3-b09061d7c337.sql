
-- Create property_units table
CREATE TABLE public.property_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties_v2(id) ON DELETE CASCADE,
  unit_name TEXT NOT NULL DEFAULT 'Main House',
  rent_basis TEXT NOT NULL DEFAULT 'room' CHECK (rent_basis IN ('room', 'whole_house')),
  whole_house_rent_pcm NUMERIC NULL,
  is_lettable BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add unit_id to rooms_v2 (nullable for backward compat)
ALTER TABLE public.rooms_v2 ADD COLUMN unit_id UUID NULL REFERENCES public.property_units(id) ON DELETE SET NULL;

-- Create index for fast lookups
CREATE INDEX idx_property_units_property_id ON public.property_units(property_id);
CREATE INDEX idx_rooms_v2_unit_id ON public.rooms_v2(unit_id);

-- Enable RLS
ALTER TABLE public.property_units ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can manage units for properties they have access to via org membership
CREATE POLICY "Users can view units for their org properties"
ON public.property_units FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.properties_v2 p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE p.id = property_units.property_id
    AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert units for their org properties"
ON public.property_units FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.properties_v2 p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE p.id = property_units.property_id
    AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update units for their org properties"
ON public.property_units FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.properties_v2 p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE p.id = property_units.property_id
    AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete units for their org properties"
ON public.property_units FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.properties_v2 p
    JOIN public.memberships m ON m.org_id = p.org_id
    WHERE p.id = property_units.property_id
    AND m.user_id = auth.uid()
  )
);

-- Auto-create a default "Main House" unit for all existing properties
INSERT INTO public.property_units (property_id, unit_name, rent_basis, whole_house_rent_pcm)
SELECT id, 'Main House', rent_basis, whole_house_rent_pcm
FROM public.properties_v2;

-- Link existing rooms to their property's default unit
UPDATE public.rooms_v2 r
SET unit_id = pu.id
FROM public.property_units pu
WHERE pu.property_id = r.property_id
AND pu.unit_name = 'Main House';

-- Trigger for updated_at
CREATE TRIGGER update_property_units_updated_at
BEFORE UPDATE ON public.property_units
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
