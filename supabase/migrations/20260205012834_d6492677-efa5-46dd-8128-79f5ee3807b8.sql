-- ============================================
-- ENHANCE CONTRACTORS TABLE
-- ============================================

ALTER TABLE public.contractors
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(2,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_jobs INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_response_hours INTEGER,
ADD COLUMN IF NOT EXISTS hourly_rate_gbp INTEGER,
ADD COLUMN IF NOT EXISTS call_out_fee_gbp INTEGER,
ADD COLUMN IF NOT EXISTS typical_costs JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS availability_notes TEXT,
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ============================================
-- CONTRACTOR JOBS TABLE
-- ============================================

CREATE TABLE public.contractor_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  compliance_item_id UUID REFERENCES public.compliance_items(id) ON DELETE SET NULL,
  contractor_id UUID REFERENCES public.contractors(id) ON DELETE SET NULL,
  
  job_type TEXT NOT NULL,
  description TEXT,
  
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'requested', 'quoted', 'accepted', 'booked', 
    'in_progress', 'completed', 'verified', 'cancelled'
  )),
  
  requested_at TIMESTAMPTZ,
  quoted_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  booked_date DATE,
  booked_time_slot TEXT,
  completed_at TIMESTAMPTZ,
  
  quoted_amount_gbp INTEGER,
  final_amount_gbp INTEGER,
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'invoiced', 'paid')),
  invoice_reference TEXT,
  
  request_message TEXT,
  contractor_notes TEXT,
  internal_notes TEXT,
  
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contractor_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage jobs"
ON public.contractor_jobs FOR ALL
USING (public.user_has_org_access(org_id));

CREATE INDEX idx_contractor_jobs_property ON public.contractor_jobs(property_id);
CREATE INDEX idx_contractor_jobs_contractor ON public.contractor_jobs(contractor_id);
CREATE INDEX idx_contractor_jobs_status ON public.contractor_jobs(status) WHERE status NOT IN ('completed', 'verified', 'cancelled');
CREATE INDEX idx_contractor_jobs_booked ON public.contractor_jobs(booked_date) WHERE booked_date IS NOT NULL;

-- ============================================
-- CONTRACTOR REVIEWS TABLE
-- ============================================

CREATE TABLE public.contractor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  contractor_id UUID REFERENCES public.contractors(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.contractor_jobs(id) ON DELETE SET NULL,
  
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  punctuality_rating INTEGER CHECK (punctuality_rating >= 1 AND punctuality_rating <= 5),
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contractor_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage reviews"
ON public.contractor_reviews FOR ALL
USING (public.user_has_org_access(org_id));

-- ============================================
-- JOB REQUEST TEMPLATES
-- ============================================

CREATE TABLE public.job_request_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  name TEXT NOT NULL,
  compliance_type TEXT,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_request_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage templates"
ON public.job_request_templates FOR ALL
USING (public.user_has_org_access(org_id));

-- ============================================
-- CONTRACTOR SERVICE AREAS
-- ============================================

CREATE TABLE public.contractor_service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID REFERENCES public.contractors(id) ON DELETE CASCADE NOT NULL,
  
  postcode_prefix TEXT,
  postcode_district TEXT,
  city TEXT,
  county TEXT,
  
  priority INTEGER DEFAULT 1,
  
  UNIQUE(contractor_id, postcode_prefix)
);

ALTER TABLE public.contractor_service_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage service areas"
ON public.contractor_service_areas FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM contractors c
    WHERE c.id = contractor_id
    AND public.user_has_org_access(c.org_id)
  )
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION find_matching_contractors(
  p_org_id UUID,
  p_compliance_type TEXT,
  p_postcode TEXT
)
RETURNS TABLE (
  contractor_id UUID,
  name TEXT,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  average_rating DECIMAL,
  total_jobs INTEGER,
  typical_cost INTEGER,
  match_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_postcode_prefix TEXT;
  v_postcode_district TEXT;
BEGIN
  v_postcode_district := split_part(p_postcode, ' ', 1);
  v_postcode_prefix := substring(v_postcode_district from '^[A-Z]+');
  
  RETURN QUERY
  SELECT 
    c.id as contractor_id,
    c.name,
    c.company_name,
    c.email,
    c.phone,
    c.average_rating,
    c.total_jobs,
    (c.typical_costs->>p_compliance_type)::INTEGER as typical_cost,
    (
      CASE WHEN p_compliance_type = ANY(c.compliance_types) THEN 50 ELSE 0 END +
      CASE WHEN c.is_preferred THEN 30 ELSE 0 END +
      CASE WHEN c.average_rating >= 4 THEN 20 ELSE (c.average_rating * 4)::INTEGER END +
      CASE WHEN EXISTS (
        SELECT 1 FROM contractor_service_areas csa
        WHERE csa.contractor_id = c.id
        AND (csa.postcode_district = v_postcode_district OR csa.postcode_prefix = v_postcode_prefix)
      ) THEN 25 ELSE 0 END
    ) as match_score
  FROM contractors c
  WHERE c.org_id = p_org_id
  AND c.is_active = true
  AND (
    p_compliance_type = ANY(c.compliance_types)
    OR array_length(c.compliance_types, 1) IS NULL
  )
  ORDER BY match_score DESC, c.average_rating DESC NULLS LAST, c.total_jobs DESC
  LIMIT 10;
END;
$$;

-- Function to update contractor stats after job completion
CREATE OR REPLACE FUNCTION update_contractor_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'verified' AND OLD.status != 'verified' THEN
    UPDATE contractors
    SET 
      total_jobs = total_jobs + 1,
      last_used_at = now()
    WHERE id = NEW.contractor_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER contractor_job_completed_trigger
AFTER UPDATE ON public.contractor_jobs
FOR EACH ROW
EXECUTE FUNCTION update_contractor_stats();

-- Function to update contractor rating after review
CREATE OR REPLACE FUNCTION update_contractor_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE contractors
  SET average_rating = (
    SELECT ROUND(AVG(rating)::NUMERIC, 1)
    FROM contractor_reviews
    WHERE contractor_id = NEW.contractor_id
  )
  WHERE id = NEW.contractor_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER contractor_review_trigger
AFTER INSERT OR UPDATE ON public.contractor_reviews
FOR EACH ROW
EXECUTE FUNCTION update_contractor_rating();

-- Updated at trigger for contractor_jobs
CREATE TRIGGER update_contractor_jobs_updated_at
BEFORE UPDATE ON public.contractor_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();