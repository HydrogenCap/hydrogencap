
ALTER TABLE public.properties_v2
  ADD COLUMN epc_rating text DEFAULT NULL,
  ADD COLUMN epc_expiry_date date DEFAULT NULL;

COMMENT ON COLUMN public.properties_v2.epc_rating IS 'Energy Performance Certificate rating (A-G)';
COMMENT ON COLUMN public.properties_v2.epc_expiry_date IS 'EPC expiry date (10 years from lodgement)';
