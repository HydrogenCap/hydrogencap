-- Property inspections management
CREATE TABLE property_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  property_id uuid NOT NULL,
  inspection_type text NOT NULL CHECK (inspection_type IN ('periodic', 'check_in', 'check_out', 'mid_tenancy', 'pre_let', 'inventory', 'ad_hoc')),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  scheduled_date date NOT NULL,
  scheduled_time time,
  completed_at timestamptz,
  inspector_name text,
  tenant_notified boolean DEFAULT false,
  tenant_present boolean,
  access_notes text,
  overall_condition text CHECK (overall_condition IN ('excellent', 'good', 'fair', 'poor', 'critical')),
  summary text,
  follow_up_actions jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inspection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES property_inspections(id) ON DELETE CASCADE,
  room_name text NOT NULL,
  item_name text NOT NULL,
  condition text CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'critical', 'n/a')),
  notes text,
  photos jsonb DEFAULT '[]',
  action_required boolean DEFAULT false,
  action_description text,
  sort_order int DEFAULT 0
);

CREATE TABLE inspection_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  inspection_type text NOT NULL,
  rooms jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE property_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org inspections" ON property_inspections FOR ALL USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));
CREATE POLICY "Org inspection items" ON inspection_items FOR ALL USING (inspection_id IN (SELECT id FROM property_inspections WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())));
CREATE POLICY "Org templates" ON inspection_templates FOR ALL USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));
