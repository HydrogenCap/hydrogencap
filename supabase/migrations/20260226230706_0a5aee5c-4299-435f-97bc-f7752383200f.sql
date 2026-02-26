
-- Legal Entities table
CREATE TABLE public.legal_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('spv', 'personal', 'joint_venture', 'trust')),
  company_number TEXT,
  incorporation_date DATE,
  registered_address TEXT,
  corporation_tax_ref TEXT,
  vat_registered BOOLEAN DEFAULT false,
  vat_number TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dormant', 'dissolved')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_legal_entities_org_id ON public.legal_entities(org_id);

-- Entity Directors table
CREATE TABLE public.entity_directors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  director_name TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  resignation_date DATE,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_directors_entity_id ON public.entity_directors(entity_id);

-- Entity Shareholders table
CREATE TABLE public.entity_shareholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  shareholder_name TEXT NOT NULL,
  share_class TEXT DEFAULT 'Ordinary',
  shares_held INTEGER NOT NULL,
  percentage NUMERIC(5,2) NOT NULL,
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_shareholders_entity_id ON public.entity_shareholders(entity_id);

-- Updated_at triggers
CREATE TRIGGER update_legal_entities_updated_at
  BEFORE UPDATE ON public.legal_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_entity_directors_updated_at
  BEFORE UPDATE ON public.entity_directors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_entity_shareholders_updated_at
  BEFORE UPDATE ON public.entity_shareholders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: legal_entities (org-scoped)
ALTER TABLE public.legal_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org legal entities"
  ON public.legal_entities FOR SELECT
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can insert own org legal entities"
  ON public.legal_entities FOR INSERT
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Users can update own org legal entities"
  ON public.legal_entities FOR UPDATE
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can delete own org legal entities"
  ON public.legal_entities FOR DELETE
  USING (public.user_has_org_access(org_id));

-- RLS: entity_directors (via FK chain to legal_entities)
ALTER TABLE public.entity_directors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage entity directors"
  ON public.entity_directors FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.legal_entities le
      WHERE le.id = entity_id
      AND public.user_has_org_access(le.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.legal_entities le
      WHERE le.id = entity_id
      AND public.user_has_org_access(le.org_id)
    )
  );

-- RLS: entity_shareholders (via FK chain to legal_entities)
ALTER TABLE public.entity_shareholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage entity shareholders"
  ON public.entity_shareholders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.legal_entities le
      WHERE le.id = entity_id
      AND public.user_has_org_access(le.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.legal_entities le
      WHERE le.id = entity_id
      AND public.user_has_org_access(le.org_id)
    )
  );
