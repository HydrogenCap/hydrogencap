-- ============================================
-- Action Workflows: snooze + assignment tables
-- ============================================

-- Snoozed actions
CREATE TABLE public.action_snoozes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_key TEXT NOT NULL,
  snoozed_until TIMESTAMPTZ NOT NULL,
  reason TEXT,
  snoozed_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_snoozes_org ON public.action_snoozes(org_id);
CREATE INDEX idx_action_snoozes_lookup ON public.action_snoozes(org_id, action_type, action_key);

ALTER TABLE public.action_snoozes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage snoozes for their org"
ON public.action_snoozes
FOR ALL
USING (
  org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid())
);

-- Action assignments
CREATE TABLE public.action_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_key TEXT NOT NULL,
  assigned_to_user_id UUID REFERENCES auth.users(id),
  assigned_to_contractor_id UUID REFERENCES public.contractors(id),
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_assignee CHECK (
    assigned_to_user_id IS NOT NULL OR assigned_to_contractor_id IS NOT NULL
  )
);

CREATE INDEX idx_action_assignments_org ON public.action_assignments(org_id);
CREATE INDEX idx_action_assignments_lookup ON public.action_assignments(org_id, action_type, action_key);

ALTER TABLE public.action_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage assignments for their org"
ON public.action_assignments
FOR ALL
USING (
  org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid())
);
