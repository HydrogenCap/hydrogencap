
-- Notifications table for in-app notification centre
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  user_id UUID NOT NULL,
  category TEXT NOT NULL, -- 'compliance' | 'rent' | 'maintenance' | 'tenancy' | 'system'
  severity TEXT NOT NULL DEFAULT 'info', -- 'critical' | 'warning' | 'info' | 'success'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_to TEXT, -- app route to navigate to
  entity_type TEXT, -- 'property' | 'tenant' | 'document' | 'maintenance_request' | 'tenancy'
  entity_id UUID,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_org ON public.notifications(org_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark read, dismiss)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Authenticated users can insert notifications (for creating notifications for org members)
CREATE POLICY "Authenticated users can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
