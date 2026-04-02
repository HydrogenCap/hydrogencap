-- Contractor enhancements
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS trades text[] DEFAULT '{}';
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS coverage_areas text[] DEFAULT '{}';
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS insurance_expiry date;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS gas_safe_number text;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS niceic_number text;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS avg_rating numeric(2,1) DEFAULT 0;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS total_jobs_completed int DEFAULT 0;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS avg_response_hours numeric DEFAULT 0;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS preferred boolean DEFAULT false;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS rate_card jsonb DEFAULT '{}';

-- Job quotes
CREATE TABLE job_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  contractor_id uuid NOT NULL,
  org_id uuid NOT NULL,
  amount numeric NOT NULL,
  description text,
  valid_until date,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  attachments jsonb DEFAULT '[]',
  submitted_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Job photos/evidence
CREATE TABLE job_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  org_id uuid NOT NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN ('before_photo', 'during_photo', 'after_photo', 'receipt', 'invoice', 'certificate', 'other')),
  file_url text NOT NULL,
  description text,
  taken_at timestamptz DEFAULT now(),
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Contractor ratings per job
CREATE TABLE contractor_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL,
  job_id uuid NOT NULL,
  org_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  quality_score int CHECK (quality_score >= 1 AND quality_score <= 5),
  timeliness_score int CHECK (timeliness_score >= 1 AND timeliness_score <= 5),
  communication_score int CHECK (communication_score >= 1 AND communication_score <= 5),
  value_score int CHECK (value_score >= 1 AND value_score <= 5),
  review_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for all new tables
ALTER TABLE job_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage quotes" ON job_quotes FOR ALL USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));
CREATE POLICY "Org members manage evidence" ON job_evidence FOR ALL USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));
CREATE POLICY "Org members manage ratings" ON contractor_ratings FOR ALL USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));
