-- Add onboarding persistence to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- Add organization metadata for onboarding
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS property_types TEXT[];
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS region_focus TEXT;
