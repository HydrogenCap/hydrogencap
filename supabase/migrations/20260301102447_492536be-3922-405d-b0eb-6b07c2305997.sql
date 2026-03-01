
-- Distributions table
CREATE TABLE public.distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  entity_id UUID NOT NULL REFERENCES public.legal_entities(id),
  period_label TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_rental_income NUMERIC NOT NULL DEFAULT 0,
  total_expenses NUMERIC NOT NULL DEFAULT 0,
  total_mortgage_costs NUMERIC NOT NULL DEFAULT 0,
  net_distributable NUMERIC NOT NULL DEFAULT 0,
  total_distributed NUMERIC NOT NULL DEFAULT 0,
  retained_earnings NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Distribution allocations table
CREATE TABLE public.distribution_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL REFERENCES public.distributions(id) ON DELETE CASCADE,
  shareholder_id UUID NOT NULL REFERENCES public.entity_shareholders(id),
  shareholder_name TEXT NOT NULL,
  ownership_percent NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage distributions"
  ON public.distributions FOR ALL
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Org members manage allocations"
  ON public.distribution_allocations FOR ALL
  USING (distribution_id IN (
    SELECT id FROM public.distributions WHERE org_id IN (
      SELECT org_id FROM public.memberships WHERE user_id = auth.uid()
    )
  ));

-- Updated at trigger
CREATE TRIGGER update_distributions_updated_at
  BEFORE UPDATE ON public.distributions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
