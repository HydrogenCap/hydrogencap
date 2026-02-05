-- ============================================
-- PROPERTY VALUATIONS TABLE
-- ============================================

CREATE TABLE public.property_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Valuation data
  estimated_value_gbp INTEGER NOT NULL,
  confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low')),
  
  -- Source tracking
  valuation_method TEXT NOT NULL CHECK (valuation_method IN (
    'land_registry_comparable', 'manual', 'surveyor', 'ai_estimate', 'rightmove', 'zoopla'
  )),
  
  -- Comparable data used
  comparables_count INTEGER,
  comparables_avg_price INTEGER,
  comparables_min_price INTEGER,
  comparables_max_price INTEGER,
  
  -- AI adjustment factors
  adjustment_factors JSONB DEFAULT '{}',
  
  -- Metadata
  valuation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure one valuation per property per month
  UNIQUE(property_id, valuation_date)
);

ALTER TABLE public.property_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage valuations"
ON public.property_valuations
FOR ALL
USING (public.user_has_org_access(org_id));

CREATE INDEX idx_valuations_property ON public.property_valuations(property_id, valuation_date DESC);
CREATE INDEX idx_valuations_date ON public.property_valuations(valuation_date);

-- ============================================
-- COMPARABLE SALES TABLE
-- ============================================

CREATE TABLE public.comparable_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Property this comparable relates to
  source_property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  
  -- Sale details (from Land Registry)
  address TEXT NOT NULL,
  postcode TEXT NOT NULL,
  price_paid INTEGER NOT NULL,
  sale_date DATE NOT NULL,
  property_type TEXT,
  new_build BOOLEAN DEFAULT false,
  tenure TEXT,
  
  -- Location
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  distance_meters INTEGER,
  
  -- Land Registry unique ID
  transaction_id TEXT UNIQUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comparable_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view comparables"
ON public.comparable_sales
FOR ALL
USING (public.user_has_org_access(org_id));

CREATE INDEX idx_comparables_postcode ON public.comparable_sales(postcode);
CREATE INDEX idx_comparables_source ON public.comparable_sales(source_property_id);
CREATE INDEX idx_comparables_date ON public.comparable_sales(sale_date DESC);

-- ============================================
-- REFINANCING OPPORTUNITIES TABLE
-- ============================================

CREATE TABLE public.refinancing_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Current state
  current_value_gbp INTEGER NOT NULL,
  current_mortgage_gbp INTEGER NOT NULL,
  current_ltv DECIMAL(5, 2) NOT NULL,
  
  -- Opportunity details
  target_ltv DECIMAL(5, 2) NOT NULL DEFAULT 75.00,
  potential_release_gbp INTEGER NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN (
    'identified', 'under_review', 'in_progress', 'completed', 'dismissed'
  )),
  
  -- Tracking
  identified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.refinancing_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage opportunities"
ON public.refinancing_opportunities
FOR ALL
USING (public.user_has_org_access(org_id));

CREATE INDEX idx_refinancing_property ON public.refinancing_opportunities(property_id);
CREATE INDEX idx_refinancing_status ON public.refinancing_opportunities(status);

-- ============================================
-- VALUATION ALERTS TABLE
-- ============================================

CREATE TABLE public.valuation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Alert details
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'value_increase', 'value_decrease', 'refinance_opportunity', 'comparable_sale'
  )),
  
  -- Values
  recorded_value_gbp INTEGER,
  estimated_value_gbp INTEGER,
  change_percent DECIMAL(5, 2),
  
  -- Status
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  
  -- Message
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.valuation_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage alerts"
ON public.valuation_alerts
FOR ALL
USING (public.user_has_org_access(org_id));

CREATE INDEX idx_valuation_alerts_unread ON public.valuation_alerts(org_id, is_read) WHERE is_read = false;
CREATE INDEX idx_valuation_alerts_property ON public.valuation_alerts(property_id);

-- ============================================
-- ADD TRACKING COLUMNS TO PROPERTIES
-- ============================================

ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS last_valuation_date DATE,
ADD COLUMN IF NOT EXISTS last_valuation_estimate INTEGER,
ADD COLUMN IF NOT EXISTS valuation_confidence TEXT,
ADD COLUMN IF NOT EXISTS value_change_percent DECIMAL(5, 2);