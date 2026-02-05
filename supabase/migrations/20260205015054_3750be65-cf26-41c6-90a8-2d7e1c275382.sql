-- ============================================
-- ADD AUTO-JOB TRACKING TO COMPLIANCE ITEMS
-- ============================================

ALTER TABLE public.compliance_items
ADD COLUMN IF NOT EXISTS auto_job_created BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_job_id UUID REFERENCES public.contractor_jobs(id) ON DELETE SET NULL;

-- ============================================
-- ADD SOURCE TRACKING TO JOBS
-- ============================================

ALTER TABLE public.contractor_jobs
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS auto_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

-- Add check constraints separately
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contractor_jobs_source_check'
  ) THEN
    ALTER TABLE public.contractor_jobs
    ADD CONSTRAINT contractor_jobs_source_check 
    CHECK (source IN ('manual', 'auto_compliance', 'auto_rate_expiry'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contractor_jobs_priority_check'
  ) THEN
    ALTER TABLE public.contractor_jobs
    ADD CONSTRAINT contractor_jobs_priority_check 
    CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
  END IF;
END $$;

-- ============================================
-- FUNCTION: Create jobs for expiring compliance
-- ============================================

CREATE OR REPLACE FUNCTION create_jobs_for_expiring_compliance()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_compliance RECORD;
  v_job_id UUID;
  v_property RECORD;
  v_days_until INTEGER;
  v_priority TEXT;
BEGIN
  -- Find compliance items expiring within 90 days that don't have a job yet
  FOR v_compliance IN
    SELECT 
      ci.id,
      ci.property_id,
      ci.org_id,
      ci.compliance_type,
      ci.expiry_date,
      ci.responsible_party
    FROM compliance_items ci
    WHERE ci.expiry_date IS NOT NULL
    AND ci.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
    AND ci.expiry_date > CURRENT_DATE
    AND (ci.auto_job_created = false OR ci.auto_job_created IS NULL)
    AND ci.is_manually_excluded = false
    AND NOT EXISTS (
      -- Don't create if there's already an active job for this compliance item
      SELECT 1 FROM contractor_jobs cj
      WHERE cj.compliance_item_id = ci.id
      AND cj.status NOT IN ('completed', 'verified', 'cancelled')
    )
  LOOP
    -- Get property details
    SELECT address_line, postcode INTO v_property
    FROM properties
    WHERE id = v_compliance.property_id;
    
    -- Calculate days until expiry and determine priority
    v_days_until := v_compliance.expiry_date - CURRENT_DATE;
    
    IF v_days_until <= 14 THEN
      v_priority := 'urgent';
    ELSIF v_days_until <= 30 THEN
      v_priority := 'high';
    ELSIF v_days_until <= 60 THEN
      v_priority := 'normal';
    ELSE
      v_priority := 'low';
    END IF;
    
    -- Create the job
    INSERT INTO contractor_jobs (
      org_id,
      property_id,
      compliance_item_id,
      job_type,
      description,
      status,
      source,
      auto_created_at,
      priority
    )
    VALUES (
      v_compliance.org_id,
      v_compliance.property_id,
      v_compliance.id,
      v_compliance.compliance_type,
      'Auto-created: ' || v_compliance.compliance_type || ' expires ' || 
        to_char(v_compliance.expiry_date, 'DD Mon YYYY') || ' at ' || 
        COALESCE(v_property.address_line, 'Unknown'),
      'draft',
      'auto_compliance',
      now(),
      v_priority
    )
    RETURNING id INTO v_job_id;
    
    -- Mark compliance item as having a job
    UPDATE compliance_items
    SET auto_job_created = true, auto_job_id = v_job_id
    WHERE id = v_compliance.id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- ============================================
-- FUNCTION: Update job priority based on expiry
-- ============================================

CREATE OR REPLACE FUNCTION update_job_priorities()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Update priorities for jobs linked to compliance items
  UPDATE contractor_jobs cj
  SET priority = CASE
    WHEN ci.expiry_date - CURRENT_DATE <= 14 THEN 'urgent'
    WHEN ci.expiry_date - CURRENT_DATE <= 30 THEN 'high'
    WHEN ci.expiry_date - CURRENT_DATE <= 60 THEN 'normal'
    ELSE 'low'
  END
  FROM compliance_items ci
  WHERE cj.compliance_item_id = ci.id
  AND cj.status NOT IN ('completed', 'verified', 'cancelled')
  AND ci.expiry_date IS NOT NULL
  AND cj.priority IS DISTINCT FROM CASE
    WHEN ci.expiry_date - CURRENT_DATE <= 14 THEN 'urgent'
    WHEN ci.expiry_date - CURRENT_DATE <= 30 THEN 'high'
    WHEN ci.expiry_date - CURRENT_DATE <= 60 THEN 'normal'
    ELSE 'low'
  END;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================
-- TRIGGER: Reset auto_job_created when compliance renewed
-- ============================================

CREATE OR REPLACE FUNCTION reset_compliance_job_on_renewal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If expiry date changed (renewed), reset the auto job flag
  IF OLD.expiry_date IS DISTINCT FROM NEW.expiry_date 
     AND NEW.expiry_date > OLD.expiry_date THEN
    NEW.auto_job_created := false;
    NEW.auto_job_id := NULL;
    
    -- Cancel any draft jobs for this compliance item
    UPDATE contractor_jobs
    SET status = 'cancelled',
        internal_notes = COALESCE(internal_notes, '') || E'\nAuto-cancelled: Compliance was renewed.'
    WHERE compliance_item_id = OLD.id
    AND status = 'draft';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS compliance_renewal_trigger ON public.compliance_items;

CREATE TRIGGER compliance_renewal_trigger
BEFORE UPDATE ON public.compliance_items
FOR EACH ROW
EXECUTE FUNCTION reset_compliance_job_on_renewal();