
BEGIN;

-- ============================================================
-- Step A: Build bridge V1 properties.id -> V2 properties_v2.id
-- ============================================================
CREATE TEMP TABLE tmp_property_id_remap (
  v1_id uuid PRIMARY KEY,
  v2_id uuid NOT NULL,
  match_strategy text NOT NULL
) ON COMMIT DROP;

-- Strategy 1: exact (address_line, postcode) match
INSERT INTO tmp_property_id_remap (v1_id, v2_id, match_strategy)
SELECT p.id, v.id, 'address_postcode_exact'
FROM public.properties p
JOIN public.properties_v2 v
  ON lower(trim(p.address_line)) = lower(trim(v.address_line_1))
 AND lower(trim(p.postcode)) = lower(trim(v.postcode))
ON CONFLICT (v1_id) DO NOTHING;

-- Strategy 2: postcode + leading-house-number fuzzy fallback (unique only)
INSERT INTO tmp_property_id_remap (v1_id, v2_id, match_strategy)
SELECT v1.id, v2_match.v2_id, 'postcode_plus_house_number'
FROM public.properties v1
JOIN LATERAL (
  SELECT v.id AS v2_id
  FROM public.properties_v2 v
  WHERE lower(trim(v.postcode)) = lower(trim(v1.postcode))
    AND regexp_replace(coalesce(v.address_line_1,''), '^[^0-9]*([0-9]+).*', '\1')
        = regexp_replace(coalesce(v1.address_line,''), '^[^0-9]*([0-9]+).*', '\1')
  LIMIT 2
) v2_match ON TRUE
WHERE NOT EXISTS (SELECT 1 FROM tmp_property_id_remap r WHERE r.v1_id = v1.id)
  AND (SELECT count(*) FROM public.properties_v2 v
       WHERE lower(trim(v.postcode)) = lower(trim(v1.postcode))
         AND regexp_replace(coalesce(v.address_line_1,''), '^[^0-9]*([0-9]+).*', '\1')
             = regexp_replace(coalesce(v1.address_line,''), '^[^0-9]*([0-9]+).*', '\1')
      ) = 1
ON CONFLICT (v1_id) DO NOTHING;

-- Strategy 3: identity (V1 id already exists in V2 — handles the 24 West Street shadow row)
INSERT INTO tmp_property_id_remap (v1_id, v2_id, match_strategy)
SELECT v.id, v.id, 'identity_shadow_row'
FROM public.properties_v2 v
WHERE NOT EXISTS (SELECT 1 FROM tmp_property_id_remap r WHERE r.v1_id = v.id)
ON CONFLICT (v1_id) DO NOTHING;

-- ============================================================
-- Step B: Bridge-completeness assertions per FK
-- ============================================================
DO $$
DECLARE
  unresolved_count int;
  sample text;
BEGIN
  SELECT count(*),
         string_agg(format('(%s,%s)', po.id, po.property_id), ', ' ORDER BY po.id)
                                                FILTER (WHERE rn <= 5)
    INTO unresolved_count, sample
  FROM (
    SELECT po.id, po.property_id, row_number() OVER (ORDER BY po.id) AS rn
    FROM public.property_ownership po
    WHERE NOT EXISTS (SELECT 1 FROM tmp_property_id_remap r WHERE r.v1_id = po.property_id)
      AND NOT EXISTS (SELECT 1 FROM public.properties_v2 v WHERE v.id = po.property_id)
  ) po;
  IF unresolved_count > 0 THEN
    RAISE EXCEPTION 'property_ownership: % rows cannot be remapped. First 5: %', unresolved_count, sample;
  END IF;
END $$;

DO $$
DECLARE
  unresolved_count int;
  sample text;
BEGIN
  SELECT count(*),
         string_agg(format('(%s,%s)', pp.id, pp.property_id), ', ' ORDER BY pp.id)
                                                FILTER (WHERE rn <= 5)
    INTO unresolved_count, sample
  FROM (
    SELECT pp.id, pp.property_id, row_number() OVER (ORDER BY pp.id) AS rn
    FROM public.property_passport pp
    WHERE NOT EXISTS (SELECT 1 FROM tmp_property_id_remap r WHERE r.v1_id = pp.property_id)
      AND NOT EXISTS (SELECT 1 FROM public.properties_v2 v WHERE v.id = pp.property_id)
  ) pp;
  IF unresolved_count > 0 THEN
    RAISE EXCEPTION 'property_passport: % rows cannot be remapped. First 5: %', unresolved_count, sample;
  END IF;
END $$;

-- ============================================================
-- Step C: Drop RLS policies that join via V1 properties (will be recreated post-swap)
-- ============================================================
DROP POLICY IF EXISTS "Users can view property ownership for their properties"   ON public.property_ownership;
DROP POLICY IF EXISTS "Users can insert property ownership for their properties" ON public.property_ownership;
DROP POLICY IF EXISTS "Users can update property ownership for their properties" ON public.property_ownership;
DROP POLICY IF EXISTS "Users can delete property ownership for their properties" ON public.property_ownership;

DROP POLICY IF EXISTS "Users can view passport for their properties"   ON public.property_passport;
DROP POLICY IF EXISTS "Users can insert passport for their properties" ON public.property_passport;
DROP POLICY IF EXISTS "Users can update passport for their properties" ON public.property_passport;
DROP POLICY IF EXISTS "Users can delete passport for their properties" ON public.property_passport;

-- ============================================================
-- Step D: Drop V1-pointing FKs so we can update the column
-- ============================================================
ALTER TABLE public.property_ownership DROP CONSTRAINT IF EXISTS property_ownership_property_id_fkey;
ALTER TABLE public.property_passport  DROP CONSTRAINT IF EXISTS property_passport_property_id_fkey;

-- ============================================================
-- Step E: Backfill property_id with V2 ids
-- ============================================================
UPDATE public.property_ownership po
SET property_id = r.v2_id
FROM tmp_property_id_remap r
WHERE po.property_id = r.v1_id
  AND po.property_id <> r.v2_id;

UPDATE public.property_passport pp
SET property_id = r.v2_id
FROM tmp_property_id_remap r
WHERE pp.property_id = r.v1_id
  AND pp.property_id <> r.v2_id;

-- Verify drift = 0 now
DO $$
DECLARE drift int;
BEGIN
  SELECT count(*) INTO drift FROM public.property_ownership po
   WHERE NOT EXISTS (SELECT 1 FROM public.properties_v2 v WHERE v.id = po.property_id);
  IF drift > 0 THEN RAISE EXCEPTION 'property_ownership post-backfill drift = %', drift; END IF;

  SELECT count(*) INTO drift FROM public.property_passport pp
   WHERE NOT EXISTS (SELECT 1 FROM public.properties_v2 v WHERE v.id = pp.property_id);
  IF drift > 0 THEN RAISE EXCEPTION 'property_passport post-backfill drift = %', drift; END IF;
END $$;

-- ============================================================
-- Step F: Add new V2-pointing FKs (preserving ON DELETE CASCADE)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_ownership_property_id_fkey') THEN
    ALTER TABLE public.property_ownership
      ADD CONSTRAINT property_ownership_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_passport_property_id_fkey') THEN
    ALTER TABLE public.property_passport
      ADD CONSTRAINT property_passport_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- Step G: Recreate RLS policies, joining via properties_v2
-- ============================================================
CREATE POLICY "Users can view property ownership for their properties"
ON public.property_ownership FOR SELECT
USING (EXISTS (SELECT 1 FROM public.properties_v2 p
               WHERE p.id = property_ownership.property_id
                 AND user_has_org_access(p.org_id)));

CREATE POLICY "Users can insert property ownership for their properties"
ON public.property_ownership FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.properties_v2 p
                    WHERE p.id = property_ownership.property_id
                      AND user_has_org_access(p.org_id)));

CREATE POLICY "Users can update property ownership for their properties"
ON public.property_ownership FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.properties_v2 p
               WHERE p.id = property_ownership.property_id
                 AND user_has_org_access(p.org_id)));

CREATE POLICY "Users can delete property ownership for their properties"
ON public.property_ownership FOR DELETE
USING (EXISTS (SELECT 1 FROM public.properties_v2 p
               WHERE p.id = property_ownership.property_id
                 AND user_has_org_access(p.org_id)));

CREATE POLICY "Users can view passport for their properties"
ON public.property_passport FOR SELECT
USING (EXISTS (SELECT 1 FROM public.properties_v2 p
               WHERE p.id = property_passport.property_id
                 AND user_has_org_access(p.org_id)));

CREATE POLICY "Users can insert passport for their properties"
ON public.property_passport FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.properties_v2 p
                    WHERE p.id = property_passport.property_id
                      AND user_has_org_access(p.org_id)));

CREATE POLICY "Users can update passport for their properties"
ON public.property_passport FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.properties_v2 p
               WHERE p.id = property_passport.property_id
                 AND user_has_org_access(p.org_id)));

CREATE POLICY "Users can delete passport for their properties"
ON public.property_passport FOR DELETE
USING (EXISTS (SELECT 1 FROM public.properties_v2 p
               WHERE p.id = property_passport.property_id
                 AND user_has_org_access(p.org_id)));

COMMIT;
