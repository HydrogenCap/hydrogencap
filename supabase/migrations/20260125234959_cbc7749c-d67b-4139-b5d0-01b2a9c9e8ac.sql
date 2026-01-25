-- Create unified ownership_links table as single source of truth
-- This replaces property_beneficial_owners, shareholdings, and entity_shareholdings

-- 1. Create the unified ownership_links table
CREATE TABLE IF NOT EXISTS public.ownership_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Subject: what is being owned (company or property)
  subject_type TEXT NOT NULL CHECK (subject_type IN ('COMPANY', 'PROPERTY')),
  subject_id UUID NOT NULL,
  
  -- Owner: who owns it (references parties table for both people and companies)
  owner_party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  
  -- Ownership details
  ownership_type TEXT NOT NULL DEFAULT 'SHAREHOLDING' CHECK (ownership_type IN ('SHAREHOLDING', 'BENEFICIAL', 'OTHER')),
  percent NUMERIC NOT NULL CHECK (percent > 0 AND percent <= 100),
  shares NUMERIC NULL, -- Optional: share count for company shareholdings
  
  -- Temporal tracking
  effective_from DATE NULL,
  effective_to DATE NULL,
  
  -- Source tracking
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'companies_house', 'import')),
  
  -- Additional info
  notes TEXT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ownership_links_subject 
  ON public.ownership_links(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_ownership_links_owner 
  ON public.ownership_links(owner_party_id);
CREATE INDEX IF NOT EXISTS idx_ownership_links_type 
  ON public.ownership_links(ownership_type);
CREATE INDEX IF NOT EXISTS idx_ownership_links_active 
  ON public.ownership_links(subject_type, subject_id) 
  WHERE effective_to IS NULL;

-- 3. Create unique constraint to prevent duplicate ownership entries
-- Using COALESCE to handle null effective_from dates
CREATE UNIQUE INDEX IF NOT EXISTS idx_ownership_links_unique
  ON public.ownership_links(subject_type, subject_id, owner_party_id, ownership_type, COALESCE(effective_from, '1900-01-01'));

-- 4. Enable RLS
ALTER TABLE public.ownership_links ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
-- View: Users can view ownership links for subjects in their org
CREATE POLICY "Users can view ownership links for their org"
ON public.ownership_links
FOR SELECT
USING (
  CASE 
    WHEN subject_type = 'COMPANY' THEN EXISTS (
      SELECT 1 FROM companies c WHERE c.id = subject_id AND user_has_org_access(c.org_id)
    )
    WHEN subject_type = 'PROPERTY' THEN EXISTS (
      SELECT 1 FROM properties p WHERE p.id = subject_id AND user_has_org_access(p.org_id)
    )
    ELSE false
  END
);

-- Insert
CREATE POLICY "Users can insert ownership links for their org"
ON public.ownership_links
FOR INSERT
WITH CHECK (
  CASE 
    WHEN subject_type = 'COMPANY' THEN EXISTS (
      SELECT 1 FROM companies c WHERE c.id = subject_id AND user_has_org_access(c.org_id)
    )
    WHEN subject_type = 'PROPERTY' THEN EXISTS (
      SELECT 1 FROM properties p WHERE p.id = subject_id AND user_has_org_access(p.org_id)
    )
    ELSE false
  END
);

-- Update
CREATE POLICY "Users can update ownership links for their org"
ON public.ownership_links
FOR UPDATE
USING (
  CASE 
    WHEN subject_type = 'COMPANY' THEN EXISTS (
      SELECT 1 FROM companies c WHERE c.id = subject_id AND user_has_org_access(c.org_id)
    )
    WHEN subject_type = 'PROPERTY' THEN EXISTS (
      SELECT 1 FROM properties p WHERE p.id = subject_id AND user_has_org_access(p.org_id)
    )
    ELSE false
  END
);

-- Delete
CREATE POLICY "Users can delete ownership links for their org"
ON public.ownership_links
FOR DELETE
USING (
  CASE 
    WHEN subject_type = 'COMPANY' THEN EXISTS (
      SELECT 1 FROM companies c WHERE c.id = subject_id AND user_has_org_access(c.org_id)
    )
    WHEN subject_type = 'PROPERTY' THEN EXISTS (
      SELECT 1 FROM properties p WHERE p.id = subject_id AND user_has_org_access(p.org_id)
    )
    ELSE false
  END
);

-- 6. Create trigger function to validate 100% ownership total
CREATE OR REPLACE FUNCTION public.validate_ownership_total()
RETURNS TRIGGER AS $$
DECLARE
  total_percent NUMERIC;
  group_type TEXT;
  group_subject TEXT;
BEGIN
  -- Get the subject info
  IF TG_OP = 'DELETE' THEN
    group_type := OLD.ownership_type;
    group_subject := OLD.subject_type || ':' || OLD.subject_id;
  ELSE
    group_type := NEW.ownership_type;
    group_subject := NEW.subject_type || ':' || NEW.subject_id;
  END IF;

  -- Calculate total for this ownership group (only active records)
  SELECT COALESCE(SUM(percent), 0)
  INTO total_percent
  FROM public.ownership_links
  WHERE subject_type = (CASE WHEN TG_OP = 'DELETE' THEN OLD.subject_type ELSE NEW.subject_type END)
    AND subject_id = (CASE WHEN TG_OP = 'DELETE' THEN OLD.subject_id ELSE NEW.subject_id END)
    AND ownership_type = (CASE WHEN TG_OP = 'DELETE' THEN OLD.ownership_type ELSE NEW.ownership_type END)
    AND effective_to IS NULL
    AND (TG_OP = 'DELETE' OR id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'));

  -- For INSERT/UPDATE, add the new/updated row's percent
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.effective_to IS NULL THEN
    total_percent := total_percent + NEW.percent;
  END IF;

  -- Allow any valid percentage during edits (0-100 total)
  -- Strict 100% validation is done in the UI before final save
  IF total_percent > 100.01 THEN
    RAISE EXCEPTION 'Total ownership percentage (%) exceeds 100%% for % (type: %)', 
      ROUND(total_percent, 2), group_subject, group_type;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. Create the trigger
DROP TRIGGER IF EXISTS validate_ownership_total_trigger ON public.ownership_links;
CREATE TRIGGER validate_ownership_total_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.ownership_links
FOR EACH ROW
EXECUTE FUNCTION public.validate_ownership_total();

-- 8. Create function for updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_ownership_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Create updated_at trigger
DROP TRIGGER IF EXISTS set_ownership_links_updated_at ON public.ownership_links;
CREATE TRIGGER set_ownership_links_updated_at
BEFORE UPDATE ON public.ownership_links
FOR EACH ROW
EXECUTE FUNCTION public.update_ownership_links_updated_at();

-- 10. Enable realtime for ownership_links
ALTER PUBLICATION supabase_realtime ADD TABLE public.ownership_links;

-- 11. Migrate existing data from shareholdings to ownership_links
-- (Only for company shareholdings)
INSERT INTO public.ownership_links (
  subject_type,
  subject_id,
  owner_party_id,
  ownership_type,
  percent,
  shares,
  effective_from,
  effective_to,
  source,
  notes,
  created_at,
  updated_at
)
SELECT 
  'COMPANY',
  s.company_id,
  s.shareholder_party_id,
  'SHAREHOLDING',
  LEAST((s.shares_held::numeric / NULLIF(sc.issued_shares, 0) * 100), 100),
  s.shares_held,
  s.effective_from::date,
  s.effective_to::date,
  LOWER(s.ownership_source),
  s.notes,
  s.created_at,
  s.updated_at
FROM public.shareholdings s
JOIN public.share_classes sc ON sc.id = s.share_class_id
WHERE s.effective_to IS NULL
ON CONFLICT DO NOTHING;

-- 12. Migrate existing data from property_beneficial_owners to ownership_links
INSERT INTO public.ownership_links (
  subject_type,
  subject_id,
  owner_party_id,
  ownership_type,
  percent,
  effective_from,
  effective_to,
  source,
  notes,
  created_at,
  updated_at
)
SELECT 
  'PROPERTY',
  pbo.property_id,
  COALESCE(c.party_id, pbo.party_id),
  'BENEFICIAL',
  pbo.beneficial_percent,
  pbo.start_date,
  pbo.end_date,
  'manual',
  pbo.notes,
  pbo.created_at,
  pbo.updated_at
FROM public.property_beneficial_owners pbo
LEFT JOIN public.companies c ON c.id = pbo.company_id
WHERE pbo.end_date IS NULL
  AND (pbo.party_id IS NOT NULL OR c.party_id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE public.ownership_links IS 'Single source of truth for all ownership records (company shareholdings and property beneficial ownership)';