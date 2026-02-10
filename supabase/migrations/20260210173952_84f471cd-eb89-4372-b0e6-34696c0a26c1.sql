-- Add solar panel tracking fields to properties
ALTER TABLE public.properties
  ADD COLUMN has_solar boolean DEFAULT false,
  ADD COLUMN solar_install_date date,
  ADD COLUMN solar_system_size_kwp numeric,
  ADD COLUMN solar_installer_name text,
  ADD COLUMN solar_mcs_number text,
  ADD COLUMN solar_feed_in_tariff boolean DEFAULT false,
  ADD COLUMN solar_seg boolean DEFAULT false;