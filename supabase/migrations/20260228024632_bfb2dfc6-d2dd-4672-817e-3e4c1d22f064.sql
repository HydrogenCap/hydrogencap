
-- ================================================================
-- Wizard System: wizard_drafts, tasks, compliance_templates
-- ================================================================

-- 1. wizard_drafts — stores in-progress wizard state as JSONB
CREATE TABLE public.wizard_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wizard_type TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}',
  entity_id UUID REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties_v2(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for wizard_type
CREATE OR REPLACE FUNCTION public.validate_wizard_draft()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.wizard_type NOT IN ('add_property', 'add_entity', 'add_compliance') THEN
    RAISE EXCEPTION 'Invalid wizard_type: %', NEW.wizard_type;
  END IF;
  IF NEW.status NOT IN ('in_progress', 'submitted', 'discarded') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_wizard_draft_trigger
  BEFORE INSERT OR UPDATE ON public.wizard_drafts
  FOR EACH ROW EXECUTE FUNCTION public.validate_wizard_draft();

CREATE INDEX idx_wizard_drafts_user ON public.wizard_drafts(user_id, wizard_type) WHERE status = 'in_progress';
CREATE INDEX idx_wizard_drafts_org ON public.wizard_drafts(org_id);

ALTER TABLE public.wizard_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own drafts"
  ON public.wizard_drafts FOR ALL
  USING (user_id = auth.uid() AND public.user_has_org_access(org_id))
  WITH CHECK (user_id = auth.uid() AND public.user_has_org_access(org_id));

CREATE TRIGGER update_wizard_drafts_updated_at
  BEFORE UPDATE ON public.wizard_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. tasks — generic task system for auto-generated and manual follow-up items
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties_v2(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  compliance_requirement_id UUID REFERENCES public.compliance_requirements_v2(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  due_date DATE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  source TEXT NOT NULL DEFAULT 'manual',
  source_wizard_id UUID REFERENCES public.wizard_drafts(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  dismissed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for tasks
CREATE OR REPLACE FUNCTION public.validate_task()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.category NOT IN ('missing_document', 'expiring_compliance', 'incomplete_data', 'financial_review', 'legal_action', 'general', 'onboarding') THEN
    RAISE EXCEPTION 'Invalid task category: %', NEW.category;
  END IF;
  IF NEW.priority NOT IN ('critical', 'high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Invalid task priority: %', NEW.priority;
  END IF;
  IF NEW.status NOT IN ('open', 'in_progress', 'completed', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid task status: %', NEW.status;
  END IF;
  IF NEW.source NOT IN ('manual', 'wizard', 'compliance_engine', 'system') THEN
    RAISE EXCEPTION 'Invalid task source: %', NEW.source;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_task_trigger
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task();

CREATE INDEX idx_tasks_org_status ON public.tasks(org_id, status) WHERE status IN ('open', 'in_progress');
CREATE INDEX idx_tasks_property ON public.tasks(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX idx_tasks_entity ON public.tasks(entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date) WHERE status = 'open';

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage tasks"
  ON public.tasks FOR ALL
  USING (public.user_has_org_access(org_id))
  WITH CHECK (public.user_has_org_access(org_id));

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. compliance_templates — reference data for UK compliance types
CREATE TABLE public.compliance_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  default_frequency_months INTEGER,
  default_lead_time_days INTEGER DEFAULT 30,
  legislation_reference TEXT,
  description TEXT,
  applies_when JSONB NOT NULL DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Validation trigger for compliance_templates category
CREATE OR REPLACE FUNCTION public.validate_compliance_template()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.category NOT IN ('safety', 'hmo', 'insurance', 'building_regs', 'licensing', 'environmental') THEN
    RAISE EXCEPTION 'Invalid compliance template category: %', NEW.category;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_compliance_template_trigger
  BEFORE INSERT OR UPDATE ON public.compliance_templates
  FOR EACH ROW EXECUTE FUNCTION public.validate_compliance_template();

ALTER TABLE public.compliance_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read templates"
  ON public.compliance_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Seed compliance templates
INSERT INTO public.compliance_templates (document_type, display_name, category, default_frequency_months, default_lead_time_days, legislation_reference, applies_when, sort_order) VALUES
  ('gas_safety_certificate',       'Gas Safety Certificate (CP12)',     'safety',       12, 30, 'Gas Safety (Installation and Use) Regulations 1998',                '{"has_gas_supply": true}', 1),
  ('epc',                          'Energy Performance Certificate',    'safety',       120, 60, 'Energy Performance of Buildings Regulations 2012',                  '{"lifecycle_stage": ["letting", "stabilised", "disposal"]}', 2),
  ('eicr',                         'Electrical Installation Report',    'safety',       60, 60, 'Electrical Safety Standards in the Private Rented Sector 2020',     '{"always": true}', 3),
  ('fire_risk_assessment',         'Fire Risk Assessment',              'safety',       12, 30, 'Regulatory Reform (Fire Safety) Order 2005',                        '{"property_type": ["hmo_licensed", "hmo_mandatory", "multi_unit_freehold"]}', 4),
  ('smoke_co_alarm_cert',          'Smoke & CO Alarm Compliance',       'safety',       12, 14, 'Smoke and Carbon Monoxide Alarm (Amendment) Regulations 2022',      '{"always": true}', 5),
  ('hmo_licence',                  'HMO Licence',                       'licensing',    60, 90, 'Housing Act 2004, Part 2',                                          '{"property_type": ["hmo_licensed"]}', 6),
  ('selective_licence',            'Selective Licence',                  'licensing',    60, 90, 'Housing Act 2004, Part 3',                                          '{"selective_licence_area": true}', 7),
  ('fire_alarm_cert',              'Fire Alarm System Certificate',     'hmo',          12, 30, 'BS 5839-6',                                                         '{"property_type": ["hmo_licensed", "hmo_mandatory"]}', 8),
  ('emergency_lighting_cert',      'Emergency Lighting Certificate',    'hmo',          12, 30, 'BS 5266-1',                                                         '{"property_type": ["hmo_licensed", "hmo_mandatory"]}', 9),
  ('pat_testing',                  'PAT Testing',                       'hmo',          12, 30, 'Electricity at Work Regulations 1989',                              '{"property_type": ["hmo_licensed", "hmo_mandatory"]}', 10),
  ('furniture_fire_safety',        'Furniture Fire Safety Compliance',   'hmo',          NULL, 30, 'Furniture and Furnishings (Fire Safety) Regulations 1988',         '{"furnished": true}', 11),
  ('legionella_risk_assessment',   'Legionella Risk Assessment',        'environmental', 24, 30, 'HSE L8 ACOP — Legionnaires Disease',                               '{"always": true}', 12),
  ('asbestos_survey',              'Asbestos Management Survey',        'environmental', NULL, 60, 'Control of Asbestos Regulations 2012',                            '{"year_built_before": 2000}', 13),
  ('buildings_insurance',          'Buildings Insurance',               'insurance',     12, 30, 'Mortgage conditions / best practice',                               '{"always": true}', 14),
  ('landlord_liability_insurance', 'Landlord Liability Insurance',      'insurance',     12, 30, 'Best practice',                                                     '{"always": true}', 15),
  ('rent_guarantee_insurance',     'Rent Guarantee Insurance',          'insurance',     12, 30, 'Optional — protects against tenant default',                        '{"optional": true}', 16);

-- 4. Add unique constraint on lenders for upsert support
ALTER TABLE public.lenders ADD CONSTRAINT uq_lenders_org_name UNIQUE (org_id, lender_name);
