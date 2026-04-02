-- Tax engine: profiles and calculation results for Section 24, SA105, and CGT

CREATE TABLE public.tax_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tax_year text NOT NULL, -- e.g. '2025/26'
  entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL, -- null = personal
  taxpayer_type text NOT NULL CHECK (taxpayer_type IN ('individual', 'partnership', 'company')),
  income_tax_rate numeric(5,2), -- personal: 20/40/45, company: 19/25
  other_income numeric NOT NULL DEFAULT 0, -- non-property income for band calculation
  personal_allowance numeric NOT NULL DEFAULT 12570,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, tax_year, entity_id)
);

CREATE TABLE public.tax_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tax_profile_id uuid REFERENCES public.tax_profiles(id) ON DELETE CASCADE,
  tax_year text NOT NULL,
  property_id uuid REFERENCES public.properties_v2(id) ON DELETE CASCADE, -- null = portfolio total

  -- SA105 fields
  gross_rent numeric NOT NULL DEFAULT 0,
  allowable_expenses numeric NOT NULL DEFAULT 0,
  finance_costs numeric NOT NULL DEFAULT 0,
  finance_cost_relief numeric NOT NULL DEFAULT 0, -- 20% basic rate credit (Section 24)
  net_property_income numeric NOT NULL DEFAULT 0,
  tax_liability numeric NOT NULL DEFAULT 0,
  effective_tax_rate numeric(5,2),

  -- CGT fields
  purchase_price numeric,
  current_value numeric,
  unrealised_gain numeric,
  estimated_cgt numeric,
  annual_exempt_amount numeric DEFAULT 3000, -- 2025-26 CGT allowance

  -- Breakdown
  expense_breakdown jsonb NOT NULL DEFAULT '{}',
  section24_impact jsonb NOT NULL DEFAULT '{}',

  calculated_at timestamptz NOT NULL DEFAULT now()
);

-- Row Level Security
ALTER TABLE public.tax_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage tax profiles"
  ON public.tax_profiles FOR ALL
  USING (org_id IN (SELECT om.org_id FROM memberships om WHERE om.user_id = auth.uid()));

CREATE POLICY "Org members manage tax calculations"
  ON public.tax_calculations FOR ALL
  USING (org_id IN (SELECT om.org_id FROM memberships om WHERE om.user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_tax_profiles_org_year ON public.tax_profiles(org_id, tax_year);
CREATE INDEX idx_tax_calcs_org_year ON public.tax_calculations(org_id, tax_year);
CREATE INDEX idx_tax_calcs_profile ON public.tax_calculations(tax_profile_id);
