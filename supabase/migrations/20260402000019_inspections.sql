-- =============================================
-- PROPERTY INSPECTIONS
-- =============================================
CREATE TABLE public.property_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  property_id uuid NOT NULL REFERENCES public.properties_v2(id),
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

-- =============================================
-- INSPECTION ITEMS (room-by-room checklist)
-- =============================================
CREATE TABLE public.inspection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.property_inspections(id) ON DELETE CASCADE,
  room_name text NOT NULL,
  item_name text NOT NULL,
  condition text CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'critical', 'n/a')),
  notes text,
  photos jsonb DEFAULT '[]',
  action_required boolean DEFAULT false,
  action_description text,
  sort_order int DEFAULT 0
);

-- =============================================
-- INSPECTION TEMPLATES
-- =============================================
CREATE TABLE public.inspection_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  inspection_type text NOT NULL,
  rooms jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.property_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org inspections" ON public.property_inspections
  FOR ALL USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Org inspection items" ON public.inspection_items
  FOR ALL USING (inspection_id IN (SELECT id FROM public.property_inspections WHERE org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid())));

CREATE POLICY "Org templates" ON public.inspection_templates
  FOR ALL USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_inspections_org ON public.property_inspections(org_id);
CREATE INDEX idx_inspections_property ON public.property_inspections(property_id);
CREATE INDEX idx_inspections_status ON public.property_inspections(status);
CREATE INDEX idx_inspections_scheduled ON public.property_inspections(scheduled_date);
CREATE INDEX idx_inspection_items_inspection ON public.inspection_items(inspection_id);
CREATE INDEX idx_inspection_templates_org ON public.inspection_templates(org_id);
