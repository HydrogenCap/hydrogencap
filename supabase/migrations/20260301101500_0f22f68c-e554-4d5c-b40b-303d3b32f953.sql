
-- Tax expenses table for manual expense entry
CREATE TABLE public.tax_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  property_id UUID NOT NULL REFERENCES public.properties_v2(id),
  tax_year TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tax_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org tax_expenses"
  ON public.tax_expenses FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org tax_expenses"
  ON public.tax_expenses FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own org tax_expenses"
  ON public.tax_expenses FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own org tax_expenses"
  ON public.tax_expenses FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX idx_tax_expenses_org_year ON public.tax_expenses(org_id, tax_year);
CREATE INDEX idx_tax_expenses_property ON public.tax_expenses(property_id);

-- Tax settings on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marginal_tax_rate NUMERIC DEFAULT 0.40;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS corporation_tax_rate NUMERIC DEFAULT 0.25;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS use_property_allowance BOOLEAN DEFAULT false;
