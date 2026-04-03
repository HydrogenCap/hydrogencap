-- Share classes
CREATE TABLE public.share_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  nominal_value NUMERIC NOT NULL DEFAULT 1.00,
  total_issued BIGINT NOT NULL DEFAULT 0,
  voting_rights BOOLEAN NOT NULL DEFAULT true,
  dividend_rights BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.share_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org share classes"
  ON public.share_classes FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can create share classes for own org"
  ON public.share_classes FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own org share classes"
  ON public.share_classes FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own org share classes"
  ON public.share_classes FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE INDEX idx_share_classes_org ON public.share_classes(org_id);
CREATE INDEX idx_share_classes_entity ON public.share_classes(entity_id);

-- Shareholdings
CREATE TABLE public.shareholdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  share_class_id UUID NOT NULL REFERENCES public.share_classes(id) ON DELETE CASCADE,
  holder_name TEXT NOT NULL,
  holder_type TEXT NOT NULL CHECK (holder_type IN ('individual', 'corporate', 'trust', 'nominee')),
  shares_held BIGINT NOT NULL CHECK (shares_held > 0),
  percentage NUMERIC NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  allotment_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shareholdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org shareholdings"
  ON public.shareholdings FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can create shareholdings for own org"
  ON public.shareholdings FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own org shareholdings"
  ON public.shareholdings FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own org shareholdings"
  ON public.shareholdings FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE INDEX idx_shareholdings_org ON public.shareholdings(org_id);
CREATE INDEX idx_shareholdings_entity ON public.shareholdings(entity_id);
CREATE INDEX idx_shareholdings_class ON public.shareholdings(share_class_id);

-- Share transfers
CREATE TABLE public.share_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  share_class_id UUID NOT NULL REFERENCES public.share_classes(id) ON DELETE CASCADE,
  from_holder TEXT NOT NULL,
  to_holder TEXT NOT NULL,
  shares_transferred BIGINT NOT NULL CHECK (shares_transferred > 0),
  transfer_date DATE NOT NULL,
  consideration NUMERIC NOT NULL DEFAULT 0,
  stamp_duty NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.share_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org share transfers"
  ON public.share_transfers FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can create share transfers for own org"
  ON public.share_transfers FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own org share transfers"
  ON public.share_transfers FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own org share transfers"
  ON public.share_transfers FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE INDEX idx_share_transfers_org ON public.share_transfers(org_id);
CREATE INDEX idx_share_transfers_entity ON public.share_transfers(entity_id);
CREATE INDEX idx_share_transfers_date ON public.share_transfers(transfer_date DESC);

-- Beneficial owners (PSC register)
CREATE TABLE public.beneficial_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  nature_of_control TEXT[] NOT NULL DEFAULT '{}',
  verified BOOLEAN NOT NULL DEFAULT false,
  psc_register_date DATE,
  nationality TEXT,
  country_of_residence TEXT,
  date_of_birth TEXT,
  service_address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beneficial_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org beneficial owners"
  ON public.beneficial_owners FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can create beneficial owners for own org"
  ON public.beneficial_owners FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own org beneficial owners"
  ON public.beneficial_owners FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own org beneficial owners"
  ON public.beneficial_owners FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE INDEX idx_beneficial_owners_org ON public.beneficial_owners(org_id);
CREATE INDEX idx_beneficial_owners_entity ON public.beneficial_owners(entity_id);
CREATE INDEX idx_beneficial_owners_verified ON public.beneficial_owners(verified);

-- Entity dividends
CREATE TABLE public.entity_dividends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  share_class_id UUID NOT NULL REFERENCES public.share_classes(id) ON DELETE CASCADE,
  declaration_date DATE NOT NULL,
  payment_date DATE,
  amount_per_share NUMERIC NOT NULL CHECK (amount_per_share > 0),
  total_amount NUMERIC NOT NULL CHECK (total_amount > 0),
  status TEXT NOT NULL DEFAULT 'declared' CHECK (status IN ('declared', 'approved', 'paid')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.entity_dividends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org entity dividends"
  ON public.entity_dividends FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can create entity dividends for own org"
  ON public.entity_dividends FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own org entity dividends"
  ON public.entity_dividends FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own org entity dividends"
  ON public.entity_dividends FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE INDEX idx_entity_dividends_org ON public.entity_dividends(org_id);
CREATE INDEX idx_entity_dividends_entity ON public.entity_dividends(entity_id);
CREATE INDEX idx_entity_dividends_class ON public.entity_dividends(share_class_id);
CREATE INDEX idx_entity_dividends_payment ON public.entity_dividends(payment_date);

-- Updated_at triggers
CREATE TRIGGER set_share_classes_updated_at
  BEFORE UPDATE ON public.share_classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_shareholdings_updated_at
  BEFORE UPDATE ON public.shareholdings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_beneficial_owners_updated_at
  BEFORE UPDATE ON public.beneficial_owners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
