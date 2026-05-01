-- Class-B §7 Ops Stack — RLS lockstep
-- Re-points go_live_checklists.property_id and insurance_policies.property_id from V1 properties → properties_v2
-- 36 rows total + 8 RLS policies rewritten in lockstep

BEGIN;

-- Step 3: Pre-flight drift counts
DO $$
DECLARE
  glc_drift int;
  ins_drift int;
BEGIN
  SELECT count(*) INTO glc_drift FROM go_live_checklists g
    WHERE property_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = g.property_id);
  SELECT count(*) INTO ins_drift FROM insurance_policies i
    WHERE property_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = i.property_id);
  RAISE NOTICE 'Pre-flight drift: go_live_checklists=%, insurance_policies=%', glc_drift, ins_drift;
END $$;

-- Step 4: Build shared bridge with 3-strategy match
CREATE TEMP TABLE tmp_property_id_remap (
  v1_id uuid PRIMARY KEY,
  v2_id uuid NOT NULL,
  match_strategy text NOT NULL
) ON COMMIT DROP;

-- Strategy A: exact (address_line, postcode)
INSERT INTO tmp_property_id_remap (v1_id, v2_id, match_strategy)
SELECT DISTINCT ON (p.id) p.id, v.id, 'exact'
FROM properties p
JOIN properties_v2 v
  ON lower(trim(p.address_line)) = lower(trim(v.address_line_1))
 AND lower(trim(p.postcode)) = lower(trim(v.postcode))
ON CONFLICT (v1_id) DO NOTHING;

-- Strategy B: postcode + leading house number
INSERT INTO tmp_property_id_remap (v1_id, v2_id, match_strategy)
SELECT DISTINCT ON (p.id) p.id, v.id, 'fuzzy_postcode_house'
FROM properties p
JOIN properties_v2 v
  ON lower(trim(p.postcode)) = lower(trim(v.postcode))
 AND split_part(trim(p.address_line), ' ', 1) = split_part(trim(v.address_line_1), ' ', 1)
WHERE NOT EXISTS (SELECT 1 FROM tmp_property_id_remap r WHERE r.v1_id = p.id)
ON CONFLICT (v1_id) DO NOTHING;

-- Strategy C: identity-pass for 24 West Street shadow row
INSERT INTO tmp_property_id_remap (v1_id, v2_id, match_strategy)
SELECT p.id, p.id, 'identity'
FROM properties p
WHERE EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = p.id)
  AND NOT EXISTS (SELECT 1 FROM tmp_property_id_remap r WHERE r.v1_id = p.id)
ON CONFLICT (v1_id) DO NOTHING;

-- Step 5: Bridge-completeness assertion across both from-columns
DO $$
DECLARE
  unresolved int;
  sample text;
BEGIN
  SELECT count(*), string_agg(format('%s:%s', src, pid), ', ') 
  INTO unresolved, sample
  FROM (
    SELECT 'glc' src, property_id::text pid FROM go_live_checklists
      WHERE property_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = property_id)
      AND NOT EXISTS (SELECT 1 FROM tmp_property_id_remap r WHERE r.v1_id = property_id)
    UNION ALL
    SELECT 'ins', property_id::text FROM insurance_policies
      WHERE property_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = property_id)
      AND NOT EXISTS (SELECT 1 FROM tmp_property_id_remap r WHERE r.v1_id = property_id)
    LIMIT 5
  ) s;
  IF unresolved > 0 THEN
    RAISE EXCEPTION 'Bridge incomplete: % unresolvable rows. First 5: %', unresolved, sample;
  END IF;
  RAISE NOTICE 'Bridge complete: 0 unresolvable rows';
END $$;

-- ============ go_live_checklists ============
-- Step 8a: Drop the 3 policies
DROP POLICY IF EXISTS "Users can insert go_live_checklists for their org properties" ON public.go_live_checklists;
DROP POLICY IF EXISTS "Users can update go_live_checklists for their org properties" ON public.go_live_checklists;
DROP POLICY IF EXISTS "Users can view go_live_checklists for their org properties" ON public.go_live_checklists;

-- Step 7a: Drop FK
ALTER TABLE public.go_live_checklists DROP CONSTRAINT IF EXISTS go_live_checklists_property_id_fkey;

-- Step 6a: Backfill
DO $$
DECLARE
  rows_updated int;
BEGIN
  UPDATE go_live_checklists g SET property_id = r.v2_id
    FROM tmp_property_id_remap r WHERE g.property_id = r.v1_id;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'go_live_checklists backfilled: % rows', rows_updated;
END $$;

-- Step 6a paranoia
DO $$
DECLARE post int;
BEGIN
  SELECT count(*) INTO post FROM go_live_checklists g
    WHERE property_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = g.property_id);
  IF post <> 0 THEN RAISE EXCEPTION 'go_live_checklists post-flight drift = %', post; END IF;
END $$;

-- Step 7a: Add FK pointing at properties_v2 (preserve CASCADE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'go_live_checklists_property_id_fkey') THEN
    ALTER TABLE public.go_live_checklists
      ADD CONSTRAINT go_live_checklists_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 8a: Recreate 3 policies joining properties_v2
CREATE POLICY "Users can insert go_live_checklists for their org properties"
  ON public.go_live_checklists FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM properties_v2 p
    JOIN memberships m ON m.org_id = p.org_id
    WHERE p.id = go_live_checklists.property_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can update go_live_checklists for their org properties"
  ON public.go_live_checklists FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM properties_v2 p
    JOIN memberships m ON m.org_id = p.org_id
    WHERE p.id = go_live_checklists.property_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can view go_live_checklists for their org properties"
  ON public.go_live_checklists FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM properties_v2 p
    JOIN memberships m ON m.org_id = p.org_id
    WHERE p.id = go_live_checklists.property_id AND m.user_id = auth.uid()
  ));

-- ============ insurance_policies ============
-- Step 8b: Drop the 5 policies
DROP POLICY IF EXISTS "Org members manage insurance" ON public.insurance_policies;
DROP POLICY IF EXISTS "Users can delete insurance for org properties" ON public.insurance_policies;
DROP POLICY IF EXISTS "Users can insert insurance for org properties" ON public.insurance_policies;
DROP POLICY IF EXISTS "Users can update insurance for org properties" ON public.insurance_policies;
DROP POLICY IF EXISTS "Users can view insurance for org properties" ON public.insurance_policies;

-- Step 7b: Drop FK
ALTER TABLE public.insurance_policies DROP CONSTRAINT IF EXISTS insurance_policies_property_id_fkey;

-- Step 6b: Backfill
DO $$
DECLARE rows_updated int;
BEGIN
  UPDATE insurance_policies i SET property_id = r.v2_id
    FROM tmp_property_id_remap r WHERE i.property_id = r.v1_id;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'insurance_policies backfilled: % rows', rows_updated;
END $$;

-- Step 6b paranoia
DO $$
DECLARE post int;
BEGIN
  SELECT count(*) INTO post FROM insurance_policies i
    WHERE property_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = i.property_id);
  IF post <> 0 THEN RAISE EXCEPTION 'insurance_policies post-flight drift = %', post; END IF;
END $$;

-- Step 7b: Add FK pointing at properties_v2 (preserve CASCADE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'insurance_policies_property_id_fkey') THEN
    ALTER TABLE public.insurance_policies
      ADD CONSTRAINT insurance_policies_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 8b: Recreate 5 policies joining properties_v2
CREATE POLICY "Org members manage insurance"
  ON public.insurance_policies FOR ALL
  USING (EXISTS (
    SELECT 1 FROM properties_v2 p
    WHERE p.id = insurance_policies.property_id AND user_has_org_access(p.org_id)
  ));

CREATE POLICY "Users can delete insurance for org properties"
  ON public.insurance_policies FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM properties_v2 p
    JOIN memberships m ON m.org_id = p.org_id
    WHERE p.id = insurance_policies.property_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert insurance for org properties"
  ON public.insurance_policies FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM properties_v2 p
    JOIN memberships m ON m.org_id = p.org_id
    WHERE p.id = insurance_policies.property_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can update insurance for org properties"
  ON public.insurance_policies FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM properties_v2 p
    JOIN memberships m ON m.org_id = p.org_id
    WHERE p.id = insurance_policies.property_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can view insurance for org properties"
  ON public.insurance_policies FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM properties_v2 p
    JOIN memberships m ON m.org_id = p.org_id
    WHERE p.id = insurance_policies.property_id AND m.user_id = auth.uid()
  ));

COMMIT;