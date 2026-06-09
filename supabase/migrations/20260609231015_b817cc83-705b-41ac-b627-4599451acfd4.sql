ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS notify_rent_collection boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_voids boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_regulatory_changes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_recommended_actions boolean NOT NULL DEFAULT true;