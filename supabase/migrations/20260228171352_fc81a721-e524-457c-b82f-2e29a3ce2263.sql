
-- Lettings Pipeline table (AC3b)
CREATE TABLE public.lettings_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  property_id UUID NOT NULL REFERENCES public.properties_v2(id),
  room_id UUID REFERENCES public.rooms_v2(id),
  void_period_id UUID REFERENCES public.void_periods(id),

  -- Pipeline stage
  stage TEXT NOT NULL DEFAULT 'marketing',

  -- Marketing
  listing_date DATE,
  advertised_rent NUMERIC,
  marketing_channels TEXT[],
  listing_urls TEXT[],

  -- Viewings
  total_enquiries INTEGER DEFAULT 0,
  total_viewings INTEGER DEFAULT 0,

  -- Referencing / Offer
  offered_to_name TEXT,
  offered_to_email TEXT,
  offered_to_phone TEXT,
  offered_rent NUMERIC,
  offer_date DATE,
  reference_status TEXT,
  reference_provider TEXT,

  -- Move-in
  target_move_in DATE,
  actual_move_in DATE,
  tenancy_id UUID REFERENCES public.tenancy_agreements(id),

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_lettings_pipeline_org ON public.lettings_pipeline(org_id, stage);
CREATE INDEX idx_lettings_pipeline_property ON public.lettings_pipeline(property_id);

-- RLS
ALTER TABLE public.lettings_pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage lettings"
  ON public.lettings_pipeline
  FOR ALL
  USING (org_id IN (SELECT m.org_id FROM public.memberships m WHERE m.user_id = auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_lettings_pipeline_updated_at
  BEFORE UPDATE ON public.lettings_pipeline
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
