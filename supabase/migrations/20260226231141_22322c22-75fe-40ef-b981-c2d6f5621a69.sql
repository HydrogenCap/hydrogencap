
-- Create properties_v2 table linked to legal_entities
CREATE TABLE public.properties_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE RESTRICT,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT NOT NULL,
  county TEXT,
  postcode TEXT NOT NULL,
  country TEXT DEFAULT 'England',
  property_type TEXT NOT NULL CHECK (property_type IN ('hmo_licensed', 'hmo_mandatory', 'single_let', 'multi_unit_freehold', 'commercial', 'mixed_use')),
  lifecycle_stage TEXT NOT NULL DEFAULT 'pipeline' CHECK (lifecycle_stage IN ('pipeline', 'acquisition', 'refurbishment', 'letting', 'stabilised', 'disposal')),
  council_name TEXT,
  council_area TEXT,
  listing_grade TEXT NOT NULL DEFAULT 'none' CHECK (listing_grade IN ('none', 'grade_i', 'grade_ii', 'grade_ii_star', 'locally_listed')),
  has_gas_supply BOOLEAN DEFAULT true,
  year_built INTEGER,
  total_floors INTEGER,
  total_lettable_rooms INTEGER DEFAULT 0,
  purchase_date DATE,
  purchase_price NUMERIC(12,2),
  current_valuation NUMERIC(12,2),
  valuation_date DATE,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_properties_v2_org_id ON public.properties_v2(org_id);
CREATE INDEX idx_properties_v2_entity_id ON public.properties_v2(entity_id);
CREATE INDEX idx_properties_v2_lifecycle_stage ON public.properties_v2(lifecycle_stage);
CREATE INDEX idx_properties_v2_property_type ON public.properties_v2(property_type);
CREATE INDEX idx_properties_v2_postcode ON public.properties_v2(postcode);

-- RLS
ALTER TABLE public.properties_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "properties_v2_select" ON public.properties_v2
  FOR SELECT USING (public.user_has_org_access(org_id));

CREATE POLICY "properties_v2_insert" ON public.properties_v2
  FOR INSERT WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "properties_v2_update" ON public.properties_v2
  FOR UPDATE USING (public.user_has_org_access(org_id));

CREATE POLICY "properties_v2_delete" ON public.properties_v2
  FOR DELETE USING (public.user_has_org_access(org_id));

-- Updated_at trigger
CREATE TRIGGER update_properties_v2_updated_at
  BEFORE UPDATE ON public.properties_v2
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
