
-- ============================================================
-- Phase 2.2: Compliance Notification Cascade
-- ============================================================

-- 1. compliance_tasks (core workflow table)
CREATE TABLE public.compliance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  property_id uuid NOT NULL REFERENCES public.properties_v2(id) ON DELETE RESTRICT,
  document_type text NOT NULL,
  compliance_requirement_id uuid REFERENCES public.compliance_requirements_v2(id),
  compliance_document_id uuid REFERENCES public.compliance_documents_v2(id),
  task_type text NOT NULL CHECK (task_type IN (
    'renewal_due','expired','missing_document','new_requirement',
    'follow_up','inspection_scheduled','certificate_received','upload_pending'
  )),
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting','completed','cancelled','overdue')),
  assigned_to text,
  due_date date,
  escalation_level integer DEFAULT 0,
  last_escalated_at timestamptz,
  contractor_id uuid REFERENCES public.compliance_contractors_v2(id),
  contractor_booked_date date,
  inspection_date date,
  quoted_cost numeric(8,2),
  actual_cost numeric(8,2),
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid,
  source text DEFAULT 'auto' CHECK (source IN ('auto','manual')),
  trigger_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_compliance_tasks_org ON public.compliance_tasks(org_id);
CREATE INDEX idx_compliance_tasks_property ON public.compliance_tasks(property_id);
CREATE INDEX idx_compliance_tasks_status ON public.compliance_tasks(status);
CREATE INDEX idx_compliance_tasks_priority ON public.compliance_tasks(priority);
CREATE INDEX idx_compliance_tasks_due_date ON public.compliance_tasks(due_date);

ALTER TABLE public.compliance_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access_compliance_tasks" ON public.compliance_tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() AND org_id = compliance_tasks.org_id)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() AND org_id = compliance_tasks.org_id)
  );

CREATE TRIGGER update_compliance_tasks_updated_at
  BEFORE UPDATE ON public.compliance_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_compliance_tasks
  AFTER INSERT OR UPDATE OR DELETE ON public.compliance_tasks
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- 2. compliance_notifications (in-app notification log for compliance cascade)
CREATE TABLE public.compliance_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  compliance_task_id uuid REFERENCES public.compliance_tasks(id),
  property_id uuid REFERENCES public.properties_v2(id),
  document_type text,
  notification_type text NOT NULL CHECK (notification_type IN (
    'expiry_90_day','expiry_60_day','expiry_30_day','expiry_14_day','expiry_7_day',
    'expired','escalation_1','escalation_2','escalation_3',
    'task_assigned','task_overdue','inspection_reminder',
    'resolution_confirmed','missing_document','custom'
  )),
  channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','sms','webhook')),
  recipient text,
  subject text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('pending','sent','delivered','failed','read','dismissed')),
  sent_at timestamptz DEFAULT now(),
  read_at timestamptz,
  metadata jsonb
);

CREATE INDEX idx_compliance_notif_org ON public.compliance_notifications(org_id);
CREATE INDEX idx_compliance_notif_task ON public.compliance_notifications(compliance_task_id);
CREATE INDEX idx_compliance_notif_status ON public.compliance_notifications(status);
CREATE INDEX idx_compliance_notif_sent ON public.compliance_notifications(sent_at DESC);

ALTER TABLE public.compliance_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access_compliance_notifications" ON public.compliance_notifications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() AND org_id = compliance_notifications.org_id)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() AND org_id = compliance_notifications.org_id)
  );

-- 3. escalation_rules
CREATE TABLE public.escalation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id),
  document_type text,
  rule_name text NOT NULL,
  trigger_condition text NOT NULL CHECK (trigger_condition IN (
    'days_before_expiry','days_after_expiry','task_open_days','task_overdue_days'
  )),
  trigger_value integer NOT NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'create_task','send_notification','escalate_priority','assign_to','send_email','flag_critical'
  )),
  action_config jsonb,
  escalation_level integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.escalation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access_escalation_rules" ON public.escalation_rules
  FOR ALL USING (
    org_id IS NULL OR EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() AND org_id = escalation_rules.org_id)
  ) WITH CHECK (
    org_id IS NULL OR EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() AND org_id = escalation_rules.org_id)
  );

-- Seed default escalation rules (org_id = NULL = global defaults)
INSERT INTO public.escalation_rules (org_id, document_type, rule_name, trigger_condition, trigger_value, action_type, action_config, escalation_level) VALUES
  (NULL, NULL, '90-day renewal reminder', 'days_before_expiry', 90, 'create_task', '{"task_type": "renewal_due", "priority": "low"}', 0),
  (NULL, NULL, '60-day warning', 'days_before_expiry', 60, 'send_notification', '{"notification_type": "expiry_60_day", "channel": "in_app"}', 0),
  (NULL, NULL, '30-day escalation', 'days_before_expiry', 30, 'escalate_priority', '{"new_priority": "high"}', 1),
  (NULL, NULL, '14-day critical warning', 'days_before_expiry', 14, 'send_notification', '{"notification_type": "expiry_14_day", "channel": "in_app"}', 1),
  (NULL, NULL, '7-day final warning', 'days_before_expiry', 7, 'flag_critical', '{"new_priority": "critical"}', 2),
  (NULL, NULL, 'Expired alert', 'days_after_expiry', 0, 'send_notification', '{"notification_type": "expired", "channel": "in_app"}', 2),
  (NULL, NULL, '7-day overdue escalation', 'days_after_expiry', 7, 'send_notification', '{"notification_type": "escalation_2", "channel": "in_app"}', 3),
  (NULL, 'hmo_licence', 'HMO licence 6-month warning', 'days_before_expiry', 180, 'create_task', '{"task_type": "renewal_due", "priority": "medium"}', 0),
  (NULL, 'hmo_licence', 'HMO licence 3-month escalation', 'days_before_expiry', 90, 'escalate_priority', '{"new_priority": "high"}', 1),
  (NULL, 'gas_safety_certificate', 'Gas safety 6-week reminder', 'days_before_expiry', 42, 'create_task', '{"task_type": "renewal_due", "priority": "high"}', 0);

-- 4. Views
CREATE OR REPLACE VIEW public.compliance_task_overview
WITH (security_invoker = true) AS
SELECT
  ct.id AS task_id,
  ct.org_id,
  ct.property_id,
  p.address_line_1 || ', ' || p.postcode AS property_address,
  le.entity_name,
  ct.document_type,
  ct.task_type,
  ct.title,
  ct.priority,
  ct.status,
  ct.assigned_to,
  ct.due_date,
  ct.escalation_level,
  ct.last_escalated_at,
  ct.contractor_id,
  cc.company_name AS contractor_name,
  ct.inspection_date,
  ct.quoted_cost,
  ct.actual_cost,
  ct.source,
  ct.notes,
  ct.resolution_notes,
  ct.resolved_at,
  ct.created_at,
  ct.updated_at,
  CASE
    WHEN ct.due_date < current_date AND ct.status NOT IN ('completed','cancelled') THEN true
    ELSE false
  END AS is_overdue,
  CASE
    WHEN ct.due_date IS NOT NULL THEN ct.due_date - current_date
    ELSE NULL
  END AS days_until_due
FROM public.compliance_tasks ct
JOIN public.properties_v2 p ON p.id = ct.property_id
LEFT JOIN public.legal_entities le ON le.id = p.entity_id
LEFT JOIN public.compliance_contractors_v2 cc ON cc.id = ct.contractor_id
ORDER BY
  CASE ct.priority
    WHEN 'critical' THEN 0
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
  END,
  ct.due_date ASC NULLS LAST;

CREATE OR REPLACE VIEW public.unread_notifications_v2
WITH (security_invoker = true) AS
SELECT
  nl.*,
  ct.title AS task_title,
  ct.priority AS task_priority,
  p.address_line_1 || ', ' || p.postcode AS property_address
FROM public.compliance_notifications nl
LEFT JOIN public.compliance_tasks ct ON ct.id = nl.compliance_task_id
LEFT JOIN public.properties_v2 p ON p.id = nl.property_id
WHERE nl.status IN ('sent','delivered')
  AND nl.read_at IS NULL
ORDER BY nl.sent_at DESC;

-- 5. Compliance scan function (V2-adapted, org-scoped)
CREATE OR REPLACE FUNCTION public.run_compliance_scan(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  item record;
  rule record;
  days_until integer;
  days_since integer;
  existing_task record;
  new_task_id uuid;
  tasks_created integer := 0;
  tasks_updated integer := 0;
  notifications_sent integer := 0;
BEGIN
  FOR item IN
    SELECT * FROM public.compliance_matrix_v2
    WHERE is_required = true AND org_id = p_org_id
  LOOP
    days_until := item.days_remaining;
    days_since := CASE
      WHEN item.calculated_status = 'expired' THEN -item.days_remaining
      WHEN item.calculated_status = 'missing' THEN NULL
      ELSE NULL
    END;

    FOR rule IN
      SELECT * FROM public.escalation_rules
      WHERE is_active = true
        AND (org_id IS NULL OR org_id = p_org_id)
        AND (document_type IS NULL OR document_type = item.document_type)
      ORDER BY trigger_value DESC
    LOOP
      IF (
        (rule.trigger_condition = 'days_before_expiry' AND days_until IS NOT NULL AND days_until <= rule.trigger_value AND days_until >= 0)
        OR (rule.trigger_condition = 'days_after_expiry' AND days_since IS NOT NULL AND days_since >= rule.trigger_value)
        OR (rule.trigger_condition = 'days_before_expiry' AND item.calculated_status = 'missing' AND rule.trigger_value <= 90)
      ) THEN
        SELECT * INTO existing_task FROM public.compliance_tasks
        WHERE property_id = item.property_id
          AND document_type = item.document_type
          AND org_id = p_org_id
          AND status NOT IN ('completed','cancelled')
        ORDER BY created_at DESC LIMIT 1;

        IF rule.action_type = 'create_task' AND existing_task IS NULL THEN
          INSERT INTO public.compliance_tasks (
            org_id, property_id, document_type, compliance_requirement_id,
            compliance_document_id, task_type, title, description,
            priority, due_date, source, trigger_date
          ) VALUES (
            p_org_id, item.property_id, item.document_type, item.requirement_id,
            item.document_id,
            COALESCE((rule.action_config->>'task_type')::text, 'renewal_due'),
            'Renew ' || item.document_type || ' for ' || item.property_address,
            CASE
              WHEN item.calculated_status = 'missing' THEN 'No current document on file.'
              WHEN days_until IS NOT NULL THEN 'Expires in ' || days_until || ' days (' || item.expiry_date || ')'
              ELSE 'Action required'
            END,
            COALESCE((rule.action_config->>'priority')::text, 'medium'),
            COALESCE(item.expiry_date, current_date + interval '30 days'),
            'auto', current_date
          ) RETURNING id INTO new_task_id;
          tasks_created := tasks_created + 1;
        END IF;

        IF rule.action_type IN ('escalate_priority','flag_critical') AND existing_task IS NOT NULL THEN
          UPDATE public.compliance_tasks
          SET priority = COALESCE((rule.action_config->>'new_priority')::text, 'high'),
              escalation_level = GREATEST(escalation_level, rule.escalation_level),
              last_escalated_at = now(), updated_at = now()
          WHERE id = existing_task.id AND escalation_level < rule.escalation_level;
          tasks_updated := tasks_updated + 1;
        END IF;

        IF rule.action_type = 'send_notification' THEN
          IF NOT EXISTS (
            SELECT 1 FROM public.compliance_notifications
            WHERE property_id = item.property_id
              AND document_type = item.document_type
              AND notification_type = (rule.action_config->>'notification_type')::text
              AND sent_at > now() - interval '24 hours'
              AND org_id = p_org_id
          ) THEN
            INSERT INTO public.compliance_notifications (
              org_id, compliance_task_id, property_id, document_type,
              notification_type, channel, message
            ) VALUES (
              p_org_id, COALESCE(new_task_id, existing_task.id),
              item.property_id, item.document_type,
              (rule.action_config->>'notification_type')::text,
              COALESCE((rule.action_config->>'channel')::text, 'in_app'),
              CASE
                WHEN item.calculated_status = 'expired' THEN item.document_type || ' for ' || item.property_address || ' has EXPIRED.'
                WHEN item.calculated_status = 'missing' THEN item.document_type || ' is MISSING for ' || item.property_address || '.'
                ELSE item.document_type || ' for ' || item.property_address || ' expires in ' || days_until || ' days.'
              END
            );
            notifications_sent := notifications_sent + 1;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- Auto-close tasks where document has been renewed
  UPDATE public.compliance_tasks ct
  SET status = 'completed', resolved_at = now(),
      resolution_notes = 'Auto-resolved: current valid document found', updated_at = now()
  FROM public.compliance_matrix_v2 cm
  WHERE ct.property_id = cm.property_id
    AND ct.document_type = cm.document_type
    AND ct.org_id = p_org_id
    AND cm.calculated_status = 'valid'
    AND ct.status NOT IN ('completed','cancelled');

  RETURN jsonb_build_object(
    'tasks_created', tasks_created,
    'tasks_updated', tasks_updated,
    'notifications_sent', notifications_sent,
    'scan_date', current_date
  );
END;
$$;
