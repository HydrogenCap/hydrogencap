-- Awaab's Law Compliance Engine
-- UK Private Rented Sector - legally binding from 1 May 2026
-- Extends maintenance_requests with hazard tracking and audit trail

-- Extend maintenance_requests with Awaab's Law fields
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS hazard_category text CHECK (hazard_category IN ('emergency', 'significant', 'standard', 'not_hazard'));
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS awaabs_law_applies boolean DEFAULT true;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS reported_at timestamptz; -- Day 0 timestamp
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS investigation_started_at timestamptz;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS investigation_due_by timestamptz; -- +10 working days
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS written_summary_sent_at timestamptz;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS written_summary_due_by timestamptz; -- +3 working days from investigation start
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS repair_started_at timestamptz;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS repair_due_by timestamptz; -- emergency: +24hrs, significant: +5 working days
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS repair_completed_at timestamptz;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS written_summary_text text;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS escalation_level text DEFAULT 'normal' CHECK (escalation_level IN ('normal', 'warning', 'critical', 'overdue', 'breach'));
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS breach_notified boolean DEFAULT false;

-- Awaab's Law audit trail (immutable)
CREATE TABLE IF NOT EXISTS awaabs_law_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id uuid NOT NULL REFERENCES maintenance_requests(id),
  org_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'hazard_reported', 'investigation_started', 'written_summary_sent',
    'repair_started', 'repair_completed', 'deadline_warning', 'deadline_breach',
    'escalation_raised', 'classification_changed', 'note_added'
  )),
  event_data jsonb DEFAULT '{}',
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE awaabs_law_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view events" ON awaabs_law_events
  FOR ALL
  USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_awaabs_events_request ON awaabs_law_events(maintenance_request_id);
CREATE INDEX IF NOT EXISTS idx_awaabs_events_org ON awaabs_law_events(org_id);
CREATE INDEX IF NOT EXISTS idx_awaabs_events_type ON awaabs_law_events(event_type);
CREATE INDEX IF NOT EXISTS idx_maintenance_hazard_category ON maintenance_requests(hazard_category) WHERE hazard_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_escalation ON maintenance_requests(escalation_level) WHERE escalation_level != 'normal';
