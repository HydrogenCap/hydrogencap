-- Add onboarding-related columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_goals JSONB DEFAULT '[]';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS checklist_dismissed BOOLEAN DEFAULT false;

-- Add portfolio size to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS estimated_portfolio_size TEXT;