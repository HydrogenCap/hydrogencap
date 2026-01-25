-- Create floorplans table
CREATE TABLE public.floorplans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'image')),
  original_file_name TEXT NOT NULL,
  final_file_name TEXT,
  version_label TEXT,
  notes TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.floorplans ENABLE ROW LEVEL SECURITY;

-- RLS policies (access via property org)
CREATE POLICY "Users can view floorplans for their properties"
  ON public.floorplans FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = floorplans.property_id AND user_has_org_access(p.org_id)
  ));

CREATE POLICY "Users can insert floorplans for their properties"
  ON public.floorplans FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = floorplans.property_id AND user_has_org_access(p.org_id)
  ));

CREATE POLICY "Users can update floorplans for their properties"
  ON public.floorplans FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = floorplans.property_id AND user_has_org_access(p.org_id)
  ));

CREATE POLICY "Users can delete floorplans for their properties"
  ON public.floorplans FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = floorplans.property_id AND user_has_org_access(p.org_id)
  ));

-- Function to ensure only one primary floorplan per property
CREATE OR REPLACE FUNCTION public.ensure_single_primary_floorplan()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.floorplans
    SET is_primary = false, updated_at = now()
    WHERE property_id = NEW.property_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to enforce single primary
CREATE TRIGGER ensure_single_primary_floorplan_trigger
  BEFORE INSERT OR UPDATE ON public.floorplans
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_primary_floorplan();

-- Create storage bucket for floorplans
INSERT INTO storage.buckets (id, name, public)
VALUES ('floorplans', 'floorplans', true);

-- Storage policies
CREATE POLICY "Users can view floorplans"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'floorplans');

CREATE POLICY "Authenticated users can upload floorplans"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'floorplans' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their floorplans"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'floorplans' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their floorplans"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'floorplans' AND auth.role() = 'authenticated');

-- Index for faster lookups
CREATE INDEX idx_floorplans_property_id ON public.floorplans(property_id);
CREATE INDEX idx_floorplans_primary ON public.floorplans(property_id, is_primary) WHERE is_primary = true;