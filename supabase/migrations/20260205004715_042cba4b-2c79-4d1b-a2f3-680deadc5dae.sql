-- Function to schedule compliance reminders for an item
CREATE OR REPLACE FUNCTION public.schedule_compliance_reminders(
  p_compliance_item_id UUID,
  p_expiry_date DATE,
  p_org_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_reminder_days INTEGER[];
  v_reminder_day INTEGER;
  v_scheduled_date TIMESTAMPTZ;
BEGIN
  -- Get all users in the org with their reminder preferences
  FOR v_user_id, v_reminder_days IN
    SELECT np.user_id, np.reminder_days
    FROM notification_preferences np
    JOIN memberships m ON m.user_id = np.user_id AND m.org_id = p_org_id
    WHERE np.org_id = p_org_id
    AND np.email_enabled = true
    AND np.notify_expiring_soon = true
  LOOP
    -- Schedule a reminder for each configured day
    FOREACH v_reminder_day IN ARRAY v_reminder_days
    LOOP
      v_scheduled_date := (p_expiry_date - (v_reminder_day || ' days')::INTERVAL)::TIMESTAMPTZ + '09:00:00'::TIME;
      
      -- Only schedule if in the future
      IF v_scheduled_date > now() THEN
        INSERT INTO scheduled_notifications (
          org_id, user_id, notification_type, reference_type, reference_id,
          scheduled_for, dedup_key
        )
        VALUES (
          p_org_id, v_user_id, 'compliance_reminder', 'compliance_item', p_compliance_item_id,
          v_scheduled_date, 
          'compliance_reminder:' || p_compliance_item_id || ':' || v_reminder_day || 'days:' || v_user_id
        )
        ON CONFLICT (dedup_key) DO UPDATE SET scheduled_for = EXCLUDED.scheduled_for;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Trigger to auto-schedule reminders when compliance item is created/updated
CREATE OR REPLACE FUNCTION public.trigger_schedule_compliance_reminders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.expiry_date IS NOT NULL THEN
    PERFORM schedule_compliance_reminders(NEW.id, NEW.expiry_date, NEW.org_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger (drop first if exists to avoid errors)
DROP TRIGGER IF EXISTS compliance_item_reminder_trigger ON public.compliance_items;

CREATE TRIGGER compliance_item_reminder_trigger
AFTER INSERT OR UPDATE OF expiry_date ON public.compliance_items
FOR EACH ROW
EXECUTE FUNCTION trigger_schedule_compliance_reminders();