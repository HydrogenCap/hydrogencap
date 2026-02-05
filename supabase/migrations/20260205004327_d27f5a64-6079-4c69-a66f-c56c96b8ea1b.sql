-- ============================================
-- NOTIFICATION PREFERENCES
-- ============================================

CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Email preferences
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  email_address TEXT, -- Override, defaults to auth email
  
  -- Reminder settings
  reminder_days INTEGER[] NOT NULL DEFAULT '{60,30,14,7}',
  
  -- Digest settings
  weekly_digest_enabled BOOLEAN NOT NULL DEFAULT true,
  weekly_digest_day INTEGER NOT NULL DEFAULT 1, -- 0=Sunday, 1=Monday, etc.
  
  -- Notification types
  notify_expired BOOLEAN NOT NULL DEFAULT true,
  notify_expiring_soon BOOLEAN NOT NULL DEFAULT true,
  notify_rate_expiry BOOLEAN NOT NULL DEFAULT true,
  notify_negative_cashflow BOOLEAN NOT NULL DEFAULT false,
  
  -- Timezone
  timezone TEXT NOT NULL DEFAULT 'Europe/London',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, org_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
ON public.notification_preferences
FOR ALL
USING (user_id = auth.uid());

-- ============================================
-- NOTIFICATION LOG (for tracking sent notifications)
-- ============================================

CREATE TABLE public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID,
  
  -- What triggered the notification
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'compliance_reminder', 'compliance_expired', 'weekly_digest', 
    'rate_expiry', 'negative_cashflow', 'shareholder_invite'
  )),
  
  -- Reference to the item (compliance_item, loan, etc.)
  reference_type TEXT,
  reference_id UUID,
  
  -- Delivery details
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'push')),
  recipient TEXT NOT NULL,
  subject TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view notification logs"
ON public.notification_log
FOR SELECT
USING (public.user_has_org_access(org_id));

-- Index for finding unsent notifications
CREATE INDEX idx_notification_log_pending ON public.notification_log(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_notification_log_reference ON public.notification_log(reference_type, reference_id);

-- ============================================
-- CONTRACTOR DIRECTORY
-- ============================================

CREATE TABLE public.contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Basic info
  name TEXT NOT NULL,
  company_name TEXT,
  
  -- Contact
  email TEXT,
  phone TEXT,
  website TEXT,
  
  -- Specialization
  compliance_types TEXT[] NOT NULL DEFAULT '{}',
  service_areas TEXT[] DEFAULT '{}',
  
  -- Notes
  notes TEXT,
  is_preferred BOOLEAN NOT NULL DEFAULT false,
  
  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage contractors"
ON public.contractors
FOR ALL
USING (public.user_has_org_access(org_id));

-- ============================================
-- SCHEDULED NOTIFICATION QUEUE
-- ============================================

CREATE TABLE public.scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  
  -- What to notify about
  notification_type TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  
  -- When to send
  scheduled_for TIMESTAMPTZ NOT NULL,
  
  -- Prevent duplicates
  dedup_key TEXT NOT NULL,
  
  -- Status
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(dedup_key)
);

ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage scheduled notifications"
ON public.scheduled_notifications
FOR ALL
USING (public.user_has_org_access(org_id));

CREATE INDEX idx_scheduled_notifications_pending 
ON public.scheduled_notifications(scheduled_for) 
WHERE processed = false;

-- ============================================
-- COMPLIANCE RENEWAL TRACKING (add columns to compliance_items)
-- ============================================

ALTER TABLE public.compliance_items 
ADD COLUMN IF NOT EXISTS renewal_status TEXT DEFAULT 'not_started' 
  CHECK (renewal_status IN ('not_started', 'in_progress', 'booked', 'completed')),
ADD COLUMN IF NOT EXISTS renewal_booked_date DATE,
ADD COLUMN IF NOT EXISTS renewal_contractor_id UUID REFERENCES public.contractors(id),
ADD COLUMN IF NOT EXISTS renewal_notes TEXT,
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0;

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contractors_updated_at
  BEFORE UPDATE ON public.contractors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();