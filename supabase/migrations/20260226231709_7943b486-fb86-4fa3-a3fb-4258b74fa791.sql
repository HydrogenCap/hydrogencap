
-- Create rooms_v2 table linked to properties_v2
CREATE TABLE public.rooms_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties_v2(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  room_type TEXT NOT NULL CHECK (room_type IN ('single', 'double', 'ensuite', 'studio', 'bedsit', 'communal')),
  floor INTEGER,
  has_ensuite BOOLEAN DEFAULT false,
  is_lettable BOOLEAN DEFAULT true,
  current_rent_pcm NUMERIC(8,2),
  target_rent_pcm NUMERIC(8,2),
  occupancy_status TEXT NOT NULL DEFAULT 'vacant' CHECK (occupancy_status IN ('occupied', 'vacant', 'under_offer', 'unavailable', 'refurbishment')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rooms_v2_property_id ON public.rooms_v2(property_id);
CREATE INDEX idx_rooms_v2_occupancy_status ON public.rooms_v2(occupancy_status);

-- RLS (org-scoped via property join)
ALTER TABLE public.rooms_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_v2_select" ON public.rooms_v2
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.properties_v2 p WHERE p.id = rooms_v2.property_id AND public.user_has_org_access(p.org_id))
  );

CREATE POLICY "rooms_v2_insert" ON public.rooms_v2
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.properties_v2 p WHERE p.id = rooms_v2.property_id AND public.user_has_org_access(p.org_id))
  );

CREATE POLICY "rooms_v2_update" ON public.rooms_v2
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.properties_v2 p WHERE p.id = rooms_v2.property_id AND public.user_has_org_access(p.org_id))
  );

CREATE POLICY "rooms_v2_delete" ON public.rooms_v2
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.properties_v2 p WHERE p.id = rooms_v2.property_id AND public.user_has_org_access(p.org_id))
  );

-- Updated_at trigger
CREATE TRIGGER update_rooms_v2_updated_at
  BEFORE UPDATE ON public.rooms_v2
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-update lettable room count on properties_v2
CREATE OR REPLACE FUNCTION public.update_lettable_room_count_v2()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.properties_v2
    SET total_lettable_rooms = (
      SELECT count(*) FROM public.rooms_v2
      WHERE property_id = OLD.property_id AND is_lettable = true
    ),
    updated_at = now()
    WHERE id = OLD.property_id;
    RETURN OLD;
  ELSE
    UPDATE public.properties_v2
    SET total_lettable_rooms = (
      SELECT count(*) FROM public.rooms_v2
      WHERE property_id = NEW.property_id AND is_lettable = true
    ),
    updated_at = now()
    WHERE id = NEW.property_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER trigger_update_lettable_room_count_v2
  AFTER INSERT OR UPDATE OR DELETE ON public.rooms_v2
  FOR EACH ROW EXECUTE FUNCTION public.update_lettable_room_count_v2();

-- Property room summary view
CREATE OR REPLACE VIEW public.property_room_summary_v2 AS
SELECT
  p.id AS property_id,
  count(*) FILTER (WHERE r.is_lettable = true) AS total_lettable,
  count(*) FILTER (WHERE r.is_lettable = true AND r.occupancy_status = 'occupied') AS total_occupied,
  COALESCE(sum(r.current_rent_pcm) FILTER (WHERE r.occupancy_status = 'occupied'), 0) AS gross_rent_pcm,
  COALESCE(sum(COALESCE(r.target_rent_pcm, r.current_rent_pcm)) FILTER (WHERE r.is_lettable = true), 0) AS potential_rent_pcm
FROM public.properties_v2 p
LEFT JOIN public.rooms_v2 r ON r.property_id = p.id
GROUP BY p.id;
