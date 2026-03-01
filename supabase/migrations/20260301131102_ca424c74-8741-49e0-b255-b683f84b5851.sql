ALTER TABLE public.profiles
ADD COLUMN section_visibility jsonb NOT NULL DEFAULT '{
  "lending": true,
  "investors": true,
  "distributions": true,
  "jobs": true,
  "voids": true,
  "capex": true
}'::jsonb;