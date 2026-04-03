-- CapEx Upgrade: phases, payments, photos, planning applications
-- ==============================================================

-- 1. capex_phases
CREATE TABLE IF NOT EXISTS public.capex_phases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES public.capex_projects(id) ON DELETE CASCADE,
  org_id        uuid NOT NULL,
  phase_name    text NOT NULL,
  planned_start date,
  planned_end   date,
  actual_start  date,
  actual_end    date,
  status        text NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned','in_progress','completed','delayed')),
  budget        numeric DEFAULT 0,
  actual_cost   numeric DEFAULT 0,
  depends_on_phase_id uuid REFERENCES public.capex_phases(id) ON DELETE SET NULL,
  sort_order    int DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.capex_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org capex phases"
  ON public.capex_phases FOR SELECT
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can insert their org capex phases"
  ON public.capex_phases FOR INSERT
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Users can update their org capex phases"
  ON public.capex_phases FOR UPDATE
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can delete their org capex phases"
  ON public.capex_phases FOR DELETE
  USING (public.user_has_org_access(org_id));

CREATE INDEX idx_capex_phases_project ON public.capex_phases(project_id);
CREATE INDEX idx_capex_phases_org     ON public.capex_phases(org_id);

-- 2. capex_payments
CREATE TABLE IF NOT EXISTS public.capex_payments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES public.capex_projects(id) ON DELETE CASCADE,
  phase_id              uuid REFERENCES public.capex_phases(id) ON DELETE SET NULL,
  org_id                uuid NOT NULL,
  contractor_id         uuid,
  amount                numeric NOT NULL DEFAULT 0,
  payment_type          text NOT NULL DEFAULT 'stage_payment'
                          CHECK (payment_type IN ('stage_payment','final','retention')),
  invoice_ref           text,
  invoice_url           text,
  paid_at               date,
  retention_pct         numeric DEFAULT 0,
  retention_release_date date,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE public.capex_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org capex payments"
  ON public.capex_payments FOR SELECT
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can insert their org capex payments"
  ON public.capex_payments FOR INSERT
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Users can update their org capex payments"
  ON public.capex_payments FOR UPDATE
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can delete their org capex payments"
  ON public.capex_payments FOR DELETE
  USING (public.user_has_org_access(org_id));

CREATE INDEX idx_capex_payments_project ON public.capex_payments(project_id);
CREATE INDEX idx_capex_payments_phase   ON public.capex_payments(phase_id);
CREATE INDEX idx_capex_payments_org     ON public.capex_payments(org_id);

-- 3. capex_photos
CREATE TABLE IF NOT EXISTS public.capex_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.capex_projects(id) ON DELETE CASCADE,
  phase_id    uuid REFERENCES public.capex_phases(id) ON DELETE SET NULL,
  org_id      uuid NOT NULL,
  photo_url   text NOT NULL,
  description text,
  taken_at    timestamptz DEFAULT now(),
  category    text NOT NULL DEFAULT 'during'
                CHECK (category IN ('before','during','after','issue')),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.capex_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org capex photos"
  ON public.capex_photos FOR SELECT
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can insert their org capex photos"
  ON public.capex_photos FOR INSERT
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Users can update their org capex photos"
  ON public.capex_photos FOR UPDATE
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can delete their org capex photos"
  ON public.capex_photos FOR DELETE
  USING (public.user_has_org_access(org_id));

CREATE INDEX idx_capex_photos_project ON public.capex_photos(project_id);
CREATE INDEX idx_capex_photos_phase   ON public.capex_photos(phase_id);
CREATE INDEX idx_capex_photos_org     ON public.capex_photos(org_id);

-- 4. planning_applications
CREATE TABLE IF NOT EXISTS public.planning_applications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       uuid REFERENCES public.properties_v2(id) ON DELETE CASCADE,
  project_id        uuid REFERENCES public.capex_projects(id) ON DELETE SET NULL,
  org_id            uuid NOT NULL,
  application_type  text NOT NULL DEFAULT 'planning'
                      CHECK (application_type IN ('planning','building_regs','hmo_licence','listed_building')),
  reference_number  text,
  submitted_date    date,
  authority_name    text,
  status            text NOT NULL DEFAULT 'submitted'
                      CHECK (status IN ('submitted','validated','consultation','approved','refused','conditions_discharge','withdrawn')),
  conditions        jsonb DEFAULT '[]'::jsonb,
  decision_date     date,
  expiry_date       date,
  document_urls     jsonb DEFAULT '[]'::jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE public.planning_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org planning applications"
  ON public.planning_applications FOR SELECT
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can insert their org planning applications"
  ON public.planning_applications FOR INSERT
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Users can update their org planning applications"
  ON public.planning_applications FOR UPDATE
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can delete their org planning applications"
  ON public.planning_applications FOR DELETE
  USING (public.user_has_org_access(org_id));

CREATE INDEX idx_planning_apps_property ON public.planning_applications(property_id);
CREATE INDEX idx_planning_apps_project  ON public.planning_applications(project_id);
CREATE INDEX idx_planning_apps_org      ON public.planning_applications(org_id);
