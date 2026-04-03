-- Deal Pipeline: sourcing, due diligence, offers, and post-acquisition
CREATE TABLE deal_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  -- Property basics
  address text NOT NULL,
  postcode text,
  listing_url text,
  listing_source text CHECK (listing_source IN ('rightmove', 'zoopla', 'onthemarket', 'openrent', 'auction', 'agent_direct', 'off_market', 'other')),
  asking_price numeric,
  offer_amount numeric,
  property_type text,
  beds int,
  -- Pipeline stage
  stage text NOT NULL DEFAULT 'sourced' CHECK (stage IN ('sourced', 'analysed', 'viewing_booked', 'viewed', 'offer_made', 'offer_accepted', 'due_diligence', 'exchanged', 'completed', 'withdrawn', 'rejected')),
  -- Analysis
  estimated_rental numeric,
  estimated_yield numeric(5,2),
  estimated_refurb numeric,
  ai_analysis_id uuid,
  investment_score numeric(3,2),
  -- Offer
  offer_date date,
  offer_response text CHECK (offer_response IN ('pending', 'accepted', 'rejected', 'countered')),
  counter_offer_amount numeric,
  -- Dates
  viewing_date date,
  exchange_date date,
  completion_date date,
  -- Agent
  agent_name text,
  agent_company text,
  agent_phone text,
  agent_email text,
  -- Notes
  notes text,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE due_diligence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deal_pipeline(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('legal', 'survey', 'financial', 'compliance', 'planning', 'environmental')),
  item_name text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'passed', 'failed', 'n/a')),
  assigned_to text,
  due_date date,
  cost numeric,
  notes text,
  document_url text,
  completed_at timestamptz,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_deal_pipeline_org ON deal_pipeline(org_id, stage);
CREATE INDEX idx_deal_pipeline_stage ON deal_pipeline(stage);
CREATE INDEX idx_dd_items_deal ON due_diligence_items(deal_id, category);

-- RLS
ALTER TABLE deal_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE due_diligence_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org deals" ON deal_pipeline FOR ALL
  USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));

CREATE POLICY "Org dd" ON due_diligence_items FOR ALL
  USING (deal_id IN (SELECT id FROM deal_pipeline WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())));

-- Updated-at trigger
CREATE TRIGGER update_deal_pipeline_updated_at
  BEFORE UPDATE ON deal_pipeline
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
