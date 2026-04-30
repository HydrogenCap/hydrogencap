
BEGIN;

-- =========================================================================
-- Class-B Batch 2 (retry) — 8 zero-RLS FKs from `properties` → `properties_v2`
-- Ref: docs/release/v1-v2-fk-drift-2026-04-30.md §7.4
-- Order per FK: DROP old constraint → UPDATE rows via bridge → ADD new constraint
-- (Old FK rejects V2 ids during UPDATE, so it must be dropped first.)
-- =========================================================================

-- RLS sanity: abort if any unexpected V1-properties join policy exists
DO $rls$
DECLARE
  o RECORD;
BEGIN
  FOR o IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('activity_log','compliance_items','contractor_jobs',
                        'property_valuations','refinancing_opportunities',
                        'valuation_alerts','dismissed_duplicates')
      AND (qual ~ '\mproperties\M' AND qual !~ 'properties_v2')
  LOOP
    RAISE EXCEPTION 'Unexpected RLS policy joins V1 properties: %.%', o.tablename, o.policyname;
  END LOOP;
  RAISE NOTICE '[rls-check] OK';
END
$rls$;

-- Pre-flight drift counts
DO $pf$
DECLARE n INT; tot INT := 0;
BEGIN
  SELECT COUNT(*) INTO n FROM activity_log WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = activity_log.property_id);
  RAISE NOTICE '[preflight] activity_log drift=% (expect 208)', n; tot := tot + n;
  SELECT COUNT(*) INTO n FROM compliance_items WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = compliance_items.property_id);
  RAISE NOTICE '[preflight] compliance_items drift=% (expect 117)', n; tot := tot + n;
  SELECT COUNT(*) INTO n FROM contractor_jobs WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = contractor_jobs.property_id);
  RAISE NOTICE '[preflight] contractor_jobs drift=% (expect 5)', n; tot := tot + n;
  SELECT COUNT(*) INTO n FROM property_valuations WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = property_valuations.property_id);
  RAISE NOTICE '[preflight] property_valuations drift=% (expect 2)', n; tot := tot + n;
  SELECT COUNT(*) INTO n FROM refinancing_opportunities WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = refinancing_opportunities.property_id);
  RAISE NOTICE '[preflight] refinancing_opportunities drift=% (expect 2)', n; tot := tot + n;
  SELECT COUNT(*) INTO n FROM valuation_alerts WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = valuation_alerts.property_id);
  RAISE NOTICE '[preflight] valuation_alerts drift=% (expect 2)', n; tot := tot + n;
  SELECT COUNT(*) INTO n FROM dismissed_duplicates WHERE property_id_1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = dismissed_duplicates.property_id_1);
  RAISE NOTICE '[preflight] dismissed_duplicates.p1 drift=% (expect 2)', n; tot := tot + n;
  SELECT COUNT(*) INTO n FROM dismissed_duplicates WHERE property_id_2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = dismissed_duplicates.property_id_2);
  RAISE NOTICE '[preflight] dismissed_duplicates.p2 drift=% (expect 2)', n; tot := tot + n;
  RAISE NOTICE '[preflight] TOTAL drift=% (expect 338)', tot;
END $pf$;

-- Build shared bridge
CREATE TEMP TABLE tmp_property_id_remap (
  v1_id uuid PRIMARY KEY,
  v2_id uuid NOT NULL,
  match_strategy text NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_property_id_remap (v1_id, v2_id, match_strategy)
SELECT DISTINCT ON (v1.id) v1.id, v2.id, 'exact'
FROM properties v1
JOIN properties_v2 v2
  ON lower(trim(v1.address_line)) = lower(trim(v2.address_line_1))
 AND lower(trim(v1.postcode)) = lower(trim(v2.postcode))
ON CONFLICT (v1_id) DO NOTHING;

INSERT INTO tmp_property_id_remap (v1_id, v2_id, match_strategy)
SELECT DISTINCT ON (v1.id) v1.id, v2.id, 'fuzzy_postcode_house_number'
FROM properties v1
JOIN properties_v2 v2
  ON lower(trim(v1.postcode)) = lower(trim(v2.postcode))
 AND substring(trim(v1.address_line) from '^[0-9]+') IS NOT NULL
 AND substring(trim(v1.address_line) from '^[0-9]+') = substring(trim(v2.address_line_1) from '^[0-9]+')
WHERE NOT EXISTS (SELECT 1 FROM tmp_property_id_remap r WHERE r.v1_id = v1.id)
ON CONFLICT (v1_id) DO NOTHING;

INSERT INTO tmp_property_id_remap (v1_id, v2_id, match_strategy)
VALUES ('b33f02bf-89de-416d-baa7-919a26c9a37e'::uuid,
        'b33f02bf-89de-416d-baa7-919a26c9a37e'::uuid,
        'identity_shadow')
ON CONFLICT (v1_id) DO NOTHING;

DO $br$ DECLARE n INT;
BEGIN SELECT COUNT(*) INTO n FROM tmp_property_id_remap; RAISE NOTICE '[bridge] size=%', n; END $br$;

-- Bridge-completeness across the 8 from_columns
DO $bc$
DECLARE
  unresolved INT;
  sample TEXT := '';
  r RECORD;
BEGIN
  WITH ar AS (
    SELECT 'activity_log' t, id::text rid, property_id pid FROM activity_log WHERE property_id IS NOT NULL
    UNION ALL SELECT 'compliance_items', id::text, property_id FROM compliance_items WHERE property_id IS NOT NULL
    UNION ALL SELECT 'contractor_jobs', id::text, property_id FROM contractor_jobs WHERE property_id IS NOT NULL
    UNION ALL SELECT 'property_valuations', id::text, property_id FROM property_valuations WHERE property_id IS NOT NULL
    UNION ALL SELECT 'refinancing_opportunities', id::text, property_id FROM refinancing_opportunities WHERE property_id IS NOT NULL
    UNION ALL SELECT 'valuation_alerts', id::text, property_id FROM valuation_alerts WHERE property_id IS NOT NULL
    UNION ALL SELECT 'dismissed_duplicates.p1', id::text, property_id_1 FROM dismissed_duplicates WHERE property_id_1 IS NOT NULL
    UNION ALL SELECT 'dismissed_duplicates.p2', id::text, property_id_2 FROM dismissed_duplicates WHERE property_id_2 IS NOT NULL
  )
  SELECT COUNT(*) INTO unresolved FROM ar
   WHERE NOT EXISTS (SELECT 1 FROM tmp_property_id_remap b WHERE b.v1_id = ar.pid)
     AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = ar.pid);
  IF unresolved > 0 THEN
    FOR r IN
      WITH ar AS (
        SELECT 'activity_log' t, id::text rid, property_id pid FROM activity_log WHERE property_id IS NOT NULL
        UNION ALL SELECT 'compliance_items', id::text, property_id FROM compliance_items WHERE property_id IS NOT NULL
        UNION ALL SELECT 'contractor_jobs', id::text, property_id FROM contractor_jobs WHERE property_id IS NOT NULL
        UNION ALL SELECT 'property_valuations', id::text, property_id FROM property_valuations WHERE property_id IS NOT NULL
        UNION ALL SELECT 'refinancing_opportunities', id::text, property_id FROM refinancing_opportunities WHERE property_id IS NOT NULL
        UNION ALL SELECT 'valuation_alerts', id::text, property_id FROM valuation_alerts WHERE property_id IS NOT NULL
        UNION ALL SELECT 'dismissed_duplicates.p1', id::text, property_id_1 FROM dismissed_duplicates WHERE property_id_1 IS NOT NULL
        UNION ALL SELECT 'dismissed_duplicates.p2', id::text, property_id_2 FROM dismissed_duplicates WHERE property_id_2 IS NOT NULL
      )
      SELECT t, rid, pid FROM ar
       WHERE NOT EXISTS (SELECT 1 FROM tmp_property_id_remap b WHERE b.v1_id = ar.pid)
         AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = ar.pid)
      LIMIT 5
    LOOP
      sample := sample || format(' [%s id=%s pid=%s]', r.t, r.rid, r.pid);
    END LOOP;
    RAISE EXCEPTION 'Bridge incomplete: % unresolvable refs. Sample:%', unresolved, sample;
  END IF;
  RAISE NOTICE '[bridge-completeness] OK';
END $bc$;

-- Per-FK: DROP old constraint → UPDATE → ADD new constraint
-- 1. activity_log.property_id
ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_property_id_fkey;
DO $u$ DECLARE n INT;
BEGIN
  UPDATE activity_log a SET property_id = r.v2_id
    FROM tmp_property_id_remap r WHERE a.property_id = r.v1_id AND a.property_id <> r.v2_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[backfill] activity_log updated=%', n;
END $u$;
ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;

-- 2. compliance_items.property_id
ALTER TABLE public.compliance_items DROP CONSTRAINT IF EXISTS compliance_items_property_id_fkey;
DO $u$ DECLARE n INT;
BEGIN
  UPDATE compliance_items c SET property_id = r.v2_id
    FROM tmp_property_id_remap r WHERE c.property_id = r.v1_id AND c.property_id <> r.v2_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[backfill] compliance_items updated=%', n;
END $u$;
ALTER TABLE public.compliance_items
  ADD CONSTRAINT compliance_items_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;

-- 3. contractor_jobs.property_id
ALTER TABLE public.contractor_jobs DROP CONSTRAINT IF EXISTS contractor_jobs_property_id_fkey;
DO $u$ DECLARE n INT;
BEGIN
  UPDATE contractor_jobs c SET property_id = r.v2_id
    FROM tmp_property_id_remap r WHERE c.property_id = r.v1_id AND c.property_id <> r.v2_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[backfill] contractor_jobs updated=%', n;
END $u$;
ALTER TABLE public.contractor_jobs
  ADD CONSTRAINT contractor_jobs_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;

-- 4. property_valuations.property_id
ALTER TABLE public.property_valuations DROP CONSTRAINT IF EXISTS property_valuations_property_id_fkey;
DO $u$ DECLARE n INT;
BEGIN
  UPDATE property_valuations v SET property_id = r.v2_id
    FROM tmp_property_id_remap r WHERE v.property_id = r.v1_id AND v.property_id <> r.v2_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[backfill] property_valuations updated=%', n;
END $u$;
ALTER TABLE public.property_valuations
  ADD CONSTRAINT property_valuations_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;

-- 5. refinancing_opportunities.property_id
ALTER TABLE public.refinancing_opportunities DROP CONSTRAINT IF EXISTS refinancing_opportunities_property_id_fkey;
DO $u$ DECLARE n INT;
BEGIN
  UPDATE refinancing_opportunities ro SET property_id = r.v2_id
    FROM tmp_property_id_remap r WHERE ro.property_id = r.v1_id AND ro.property_id <> r.v2_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[backfill] refinancing_opportunities updated=%', n;
END $u$;
ALTER TABLE public.refinancing_opportunities
  ADD CONSTRAINT refinancing_opportunities_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;

-- 6. valuation_alerts.property_id
ALTER TABLE public.valuation_alerts DROP CONSTRAINT IF EXISTS valuation_alerts_property_id_fkey;
DO $u$ DECLARE n INT;
BEGIN
  UPDATE valuation_alerts va SET property_id = r.v2_id
    FROM tmp_property_id_remap r WHERE va.property_id = r.v1_id AND va.property_id <> r.v2_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[backfill] valuation_alerts updated=%', n;
END $u$;
ALTER TABLE public.valuation_alerts
  ADD CONSTRAINT valuation_alerts_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;

-- 7. dismissed_duplicates.property_id_1
ALTER TABLE public.dismissed_duplicates DROP CONSTRAINT IF EXISTS dismissed_duplicates_property_id_1_fkey;
DO $u$ DECLARE n INT;
BEGIN
  UPDATE dismissed_duplicates d SET property_id_1 = r.v2_id
    FROM tmp_property_id_remap r WHERE d.property_id_1 = r.v1_id AND d.property_id_1 <> r.v2_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[backfill] dismissed_duplicates.p1 updated=%', n;
END $u$;
ALTER TABLE public.dismissed_duplicates
  ADD CONSTRAINT dismissed_duplicates_property_id_1_fkey
  FOREIGN KEY (property_id_1) REFERENCES public.properties_v2(id) ON DELETE CASCADE;

-- 8. dismissed_duplicates.property_id_2
ALTER TABLE public.dismissed_duplicates DROP CONSTRAINT IF EXISTS dismissed_duplicates_property_id_2_fkey;
DO $u$ DECLARE n INT;
BEGIN
  UPDATE dismissed_duplicates d SET property_id_2 = r.v2_id
    FROM tmp_property_id_remap r WHERE d.property_id_2 = r.v1_id AND d.property_id_2 <> r.v2_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[backfill] dismissed_duplicates.p2 updated=%', n;
END $u$;
ALTER TABLE public.dismissed_duplicates
  ADD CONSTRAINT dismissed_duplicates_property_id_2_fkey
  FOREIGN KEY (property_id_2) REFERENCES public.properties_v2(id) ON DELETE CASCADE;

-- Post-flight: per-FK paranoia
DO $pp$ DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM activity_log WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = activity_log.property_id);
  IF n <> 0 THEN RAISE EXCEPTION 'post: activity_log %', n; END IF;
  SELECT COUNT(*) INTO n FROM compliance_items WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = compliance_items.property_id);
  IF n <> 0 THEN RAISE EXCEPTION 'post: compliance_items %', n; END IF;
  SELECT COUNT(*) INTO n FROM contractor_jobs WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = contractor_jobs.property_id);
  IF n <> 0 THEN RAISE EXCEPTION 'post: contractor_jobs %', n; END IF;
  SELECT COUNT(*) INTO n FROM property_valuations WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = property_valuations.property_id);
  IF n <> 0 THEN RAISE EXCEPTION 'post: property_valuations %', n; END IF;
  SELECT COUNT(*) INTO n FROM refinancing_opportunities WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = refinancing_opportunities.property_id);
  IF n <> 0 THEN RAISE EXCEPTION 'post: refinancing_opportunities %', n; END IF;
  SELECT COUNT(*) INTO n FROM valuation_alerts WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = valuation_alerts.property_id);
  IF n <> 0 THEN RAISE EXCEPTION 'post: valuation_alerts %', n; END IF;
  SELECT COUNT(*) INTO n FROM dismissed_duplicates WHERE property_id_1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = dismissed_duplicates.property_id_1);
  IF n <> 0 THEN RAISE EXCEPTION 'post: dismissed_duplicates.p1 %', n; END IF;
  SELECT COUNT(*) INTO n FROM dismissed_duplicates WHERE property_id_2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id = dismissed_duplicates.property_id_2);
  IF n <> 0 THEN RAISE EXCEPTION 'post: dismissed_duplicates.p2 %', n; END IF;
  RAISE NOTICE '[post-flight] OK — all 8 FKs resolve to properties_v2';
END $pp$;

COMMIT;
