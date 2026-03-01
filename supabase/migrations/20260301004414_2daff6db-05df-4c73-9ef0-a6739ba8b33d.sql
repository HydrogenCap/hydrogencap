-- Add platform_role to profiles for admin capability
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS platform_role TEXT NOT NULL DEFAULT 'user';

-- Add comment for valid values
COMMENT ON COLUMN public.profiles.platform_role IS 'Platform role: user | admin | super_admin';

-- NOTE: To set yourself as super_admin, run manually:
-- UPDATE profiles SET platform_role = 'super_admin' WHERE user_id = '<YOUR_USER_ID>';