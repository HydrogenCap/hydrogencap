
ALTER TABLE public.properties_v2
  ADD COLUMN rent_basis text NOT NULL DEFAULT 'room',
  ADD COLUMN whole_house_rent_pcm numeric DEFAULT NULL;

COMMENT ON COLUMN public.properties_v2.rent_basis IS 'room = rent tracked per room, whole_house = single rent figure for entire property';
COMMENT ON COLUMN public.properties_v2.whole_house_rent_pcm IS 'Monthly rent when rent_basis is whole_house';
