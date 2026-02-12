
-- Item 13: Add capital invested tracking to properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS capital_invested_gbp NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS stamp_duty_gbp NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS refurb_cost_gbp NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS legal_fees_gbp NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS other_acquisition_costs_gbp NUMERIC(12,2);

-- Item 14: Capex/works tracker
CREATE TABLE public.capex_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'on_hold', 'cancelled')),
  budget_gbp NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_gbp NUMERIC(12,2) NOT NULL DEFAULT 0,
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.capex_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.capex_projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  budget_gbp NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_gbp NUMERIC(12,2) NOT NULL DEFAULT 0,
  supplier TEXT,
  invoice_ref TEXT,
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.capex_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capex_line_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for capex_projects
CREATE POLICY "Users can view their org capex projects"
  ON public.capex_projects FOR SELECT
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can insert capex projects for their org"
  ON public.capex_projects FOR INSERT
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Users can update their org capex projects"
  ON public.capex_projects FOR UPDATE
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can delete their org capex projects"
  ON public.capex_projects FOR DELETE
  USING (public.user_has_org_access(org_id));

-- RLS policies for capex_line_items (via project org)
CREATE POLICY "Users can view capex line items"
  ON public.capex_line_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.capex_projects cp
    WHERE cp.id = capex_line_items.project_id
    AND public.user_has_org_access(cp.org_id)
  ));

CREATE POLICY "Users can insert capex line items"
  ON public.capex_line_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.capex_projects cp
    WHERE cp.id = capex_line_items.project_id
    AND public.user_has_org_access(cp.org_id)
  ));

CREATE POLICY "Users can update capex line items"
  ON public.capex_line_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.capex_projects cp
    WHERE cp.id = capex_line_items.project_id
    AND public.user_has_org_access(cp.org_id)
  ));

CREATE POLICY "Users can delete capex line items"
  ON public.capex_line_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.capex_projects cp
    WHERE cp.id = capex_line_items.project_id
    AND public.user_has_org_access(cp.org_id)
  ));

-- Triggers for updated_at
CREATE TRIGGER update_capex_projects_updated_at
  BEFORE UPDATE ON public.capex_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_capex_line_items_updated_at
  BEFORE UPDATE ON public.capex_line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
