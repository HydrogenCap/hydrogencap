-- Add HMO licence number column to properties_v2
ALTER TABLE public.properties_v2
ADD COLUMN hmo_licence_number TEXT NULL;

COMMENT ON COLUMN public.properties_v2.hmo_licence_number IS 'HMO licence number issued by local authority';