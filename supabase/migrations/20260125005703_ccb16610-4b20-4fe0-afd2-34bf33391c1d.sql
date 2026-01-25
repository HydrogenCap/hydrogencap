-- Create property_passport table for stock condition data
CREATE TABLE public.property_passport (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Location & classification
  town_city TEXT,
  county TEXT,
  postcode TEXT,
  local_authority TEXT,
  maintenance_area TEXT,
  asset_agreement_category TEXT,
  occupation_status TEXT,
  owned_by TEXT,
  owner_tenure TEXT,
  land_registry_title_number TEXT,
  council_tax_band TEXT,
  
  -- Building basics
  built_in_year INTEGER,
  construction_date_band TEXT,
  construction_type TEXT,
  number_of_storeys INTEGER,
  basement BOOLEAN DEFAULT false,
  parking TEXT,
  
  -- Access & safety
  keysafe_code TEXT,
  loft_access TEXT,
  has_loft_access BOOLEAN DEFAULT false,
  access_ramp BOOLEAN DEFAULT false,
  block_communal_entrance TEXT,
  communal_tv_supply BOOLEAN DEFAULT false,
  
  -- Utilities & meters
  water_stop_tap_location TEXT,
  electric_meter_location TEXT,
  gas_meter_location TEXT,
  water_meter_location TEXT,
  electric_meter_number TEXT,
  gas_meter_number TEXT,
  water_meter_number TEXT,
  
  -- Accommodation schedule
  kitchens INTEGER,
  bedrooms INTEGER,
  hmo_bed_spaces INTEGER,
  bathrooms INTEGER,
  wc_cloakroom INTEGER,
  ensuites INTEGER,
  living_rooms_communal INTEGER,
  
  -- Licensing & compliance
  hmo_licence_required BOOLEAN DEFAULT false,
  hmo_licence BOOLEAN DEFAULT false,
  hmo_licence_number TEXT,
  hmo_licence_expiry DATE,
  asset_performance_rating TEXT,
  base_clarification TEXT,
  
  -- Storage / amenities
  has_bin_store BOOLEAN DEFAULT false,
  has_cycle_store BOOLEAN DEFAULT false,
  has_guest_room BOOLEAN DEFAULT false,
  carport BOOLEAN DEFAULT false,
  
  -- Links
  photographs_link TEXT,
  dropbox_link TEXT,
  
  -- Management
  property_management_company TEXT,
  property_management_fee_percent NUMERIC
);

-- Enable RLS
ALTER TABLE public.property_passport ENABLE ROW LEVEL SECURITY;

-- RLS policies (access via property's org_id)
CREATE POLICY "Users can view passport for their properties"
ON public.property_passport
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM properties p
  WHERE p.id = property_passport.property_id
  AND user_has_org_access(p.org_id)
));

CREATE POLICY "Users can insert passport for their properties"
ON public.property_passport
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM properties p
  WHERE p.id = property_passport.property_id
  AND user_has_org_access(p.org_id)
));

CREATE POLICY "Users can update passport for their properties"
ON public.property_passport
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM properties p
  WHERE p.id = property_passport.property_id
  AND user_has_org_access(p.org_id)
));

CREATE POLICY "Users can delete passport for their properties"
ON public.property_passport
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM properties p
  WHERE p.id = property_passport.property_id
  AND user_has_org_access(p.org_id)
));

-- Trigger for updated_at
CREATE TRIGGER update_property_passport_updated_at
BEFORE UPDATE ON public.property_passport
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();