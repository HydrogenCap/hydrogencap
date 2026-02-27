
-- 1a. Create share_classes_v2 table
CREATE TABLE public.share_classes_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL DEFAULT 'Ordinary',
  issued_shares INTEGER NOT NULL DEFAULT 100,
  nominal_value NUMERIC(10,4) DEFAULT 1.0000,
  currency TEXT DEFAULT 'GBP',
  voting_rights BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Each entity can have multiple share classes but only one primary
CREATE UNIQUE INDEX idx_share_classes_v2_primary
  ON public.share_classes_v2(entity_id) WHERE is_primary = true;

-- General lookup
CREATE INDEX idx_share_classes_v2_entity ON public.share_classes_v2(entity_id);

-- Enable RLS
ALTER TABLE public.share_classes_v2 ENABLE ROW LEVEL SECURITY;

-- RLS policy: org-scoped via legal_entities → memberships
CREATE POLICY "share_classes_v2_org_access" ON public.share_classes_v2
  FOR ALL USING (
    entity_id IN (
      SELECT le.id FROM public.legal_entities le
      JOIN public.memberships m ON m.org_id = le.org_id AND m.user_id = auth.uid()
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_share_classes_v2_updated_at
  BEFORE UPDATE ON public.share_classes_v2
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 1b. Add share_class_id and effective_to to entity_shareholders
ALTER TABLE public.entity_shareholders
  ADD COLUMN share_class_id UUID REFERENCES public.share_classes_v2(id) ON DELETE SET NULL;

ALTER TABLE public.entity_shareholders
  ADD COLUMN effective_to DATE;

CREATE INDEX idx_entity_shareholders_share_class ON public.entity_shareholders(share_class_id);
CREATE INDEX idx_entity_shareholders_dates ON public.entity_shareholders(effective_date, effective_to);

-- 1c. Backfill: Create share classes from existing shareholder data
INSERT INTO public.share_classes_v2 (entity_id, class_name, issued_shares, is_primary)
SELECT DISTINCT ON (es.entity_id, COALESCE(NULLIF(TRIM(es.share_class), ''), 'Ordinary'))
  es.entity_id,
  COALESCE(NULLIF(TRIM(es.share_class), ''), 'Ordinary'),
  (SELECT COALESCE(SUM(es2.shares_held), 100)
   FROM public.entity_shareholders es2
   WHERE es2.entity_id = es.entity_id
     AND COALESCE(TRIM(es2.share_class), 'Ordinary') = COALESCE(TRIM(es.share_class), 'Ordinary')),
  ROW_NUMBER() OVER (PARTITION BY es.entity_id ORDER BY COALESCE(NULLIF(TRIM(es.share_class), ''), 'Ordinary')) = 1
FROM public.entity_shareholders es;

-- Link existing shareholders to their new share class
UPDATE public.entity_shareholders es
SET share_class_id = sc.id
FROM public.share_classes_v2 sc
WHERE sc.entity_id = es.entity_id
  AND sc.class_name = COALESCE(NULLIF(TRIM(es.share_class), ''), 'Ordinary');

-- Backfill from V1 share_classes for entities matched by company_number
INSERT INTO public.share_classes_v2 (entity_id, class_name, issued_shares, nominal_value, is_primary)
SELECT
  le.id,
  sc.name,
  sc.issued_shares,
  sc.nominal_value,
  sc.is_primary
FROM public.share_classes sc
JOIN public.companies c ON c.id = sc.company_id
JOIN public.legal_entities le ON le.company_number = c.company_number AND le.org_id = c.org_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.share_classes_v2 sc2
  WHERE sc2.entity_id = le.id AND sc2.class_name = sc.name
);

-- For SPV entities with NO share classes yet, create a default
INSERT INTO public.share_classes_v2 (entity_id, class_name, issued_shares, is_primary)
SELECT le.id, 'Ordinary', 100, true
FROM public.legal_entities le
WHERE le.entity_type = 'spv'
  AND NOT EXISTS (SELECT 1 FROM public.share_classes_v2 sc WHERE sc.entity_id = le.id);
