-- Class-B §7 passport stack — RLS-lockstep FK swap
-- 3 FKs (62 rows) + 10 RLS policies, all in one transaction.

BEGIN;

-- 1. Build shared bridge: tmp_property_id_remap (v1_id, v2_id, match_strategy)
CREATE TEMP TABLE tmp_property_id_remap (
  v1_id uuid PRIMARY KEY,
  v2_id uuid NOT NULL,
  match_strategy text NOT NULL
) ON COMMIT DROP;

-- Strategy (a): exact (address_line_1, postcode), case/whitespace-insensitive
INSERT INTO tmp_property_id_remap (v1_id, v2_id, match_strategy)
SELECT v1.id, v2.id, 'exact_address_postcode'
FROM public.properties v1
JOIN public.properties_v2 v2
  ON lower(trim(v1.address_line)) = lower(trim(v2.address_line_1))
 AND lower(trim(v1.postcode))     = lower(trim(v2.postcode))
ON CONFLICT (v1_id) DO NOTHING;

-- Strategy (b): postcode + leading-house-number fuzzy fallback
INSERT INTO tmp_property_id_remap (v1_id, v2_id, match_strategy)
SELECT v1.id, v2.id, 'postcode_plus_leading_number'
FROM public.properties v1
JOIN public.properties_v2 v2
  ON lower(trim(v1.postcode)) = lower(trim(v2.postcode))
 AND substring(trim(v1.address_line) from '^([0-9]+[a-zA-Z]?)')
   = substring(trim(v2.address_line_1) from '^([0-9]+[a-zA-Z]?)')
 AND substring(trim(v1.address_line) from '^([0-9]+[a-zA-Z]?)') IS NOT NULL
WHERE NOT EXISTS (SELECT 1 FROM tmp_property_id_remap r WHERE r.v1_id = v1.id)
ON CONFLICT (v1_id) DO NOTHING;

-- Strategy (c): identity-pass for 24 West Street shadow row (proven in #31)
INSERT INTO tmp_property_id_remap (v1_id, v2_id, match_strategy)
SELECT v1.id, v1.id, 'identity_shadow_row'
FROM public.properties v1
WHERE v1.id IN (SELECT id FROM public.properties_v2)
  AND NOT EXISTS (SELECT 1 FROM tmp_property_id_remap r WHERE r.v1_id = v1.id)
ON CONFLICT (v1_id) DO NOTHING;

-- 2. Pre-flight: emit per-FK current drift (must match §7: 22, 18, 22)
DO $$
DECLARE
  d_pas int; d_pfa int; d_ptn int;
BEGIN
  SELECT COUNT(*) INTO d_pas
    FROM public.passport_autofill_suggestions x
    WHERE x.property_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.properties_v2 v WHERE v.id = x.property_id);
  SELECT COUNT(*) INTO d_pfa
    FROM public.passport_field_audit x
    WHERE x.property_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.properties_v2 v WHERE v.id = x.property_id);
  SELECT COUNT(*) INTO d_ptn
    FROM public.property_title_numbers x
    WHERE x.property_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.properties_v2 v WHERE v.id = x.property_id);
  RAISE NOTICE 'PRE-FLIGHT DRIFT: passport_autofill_suggestions=%, passport_field_audit=%, property_title_numbers=%', d_pas, d_pfa, d_ptn;
END $$;

-- 3. Bridge-completeness assertion across the union of all 3 FK from-columns.
-- Abort with the first 5 unresolvable rows if the bridge is incomplete.
DO $$
DECLARE
  unresolved_count int;
  sample text;
BEGIN
  WITH all_refs AS (
    SELECT 'passport_autofill_suggestions' AS tbl, id::text AS row_id, property_id FROM public.passport_autofill_suggestions WHERE property_id IS NOT NULL
    UNION ALL
    SELECT 'passport_field_audit', id::text, property_id FROM public.passport_field_audit WHERE property_id IS NOT NULL
    UNION ALL
    SELECT 'property_title_numbers', id::text, property_id FROM public.property_title_numbers WHERE property_id IS NOT NULL
  ),
  unresolved AS (
    SELECT a.tbl, a.row_id, a.property_id
    FROM all_refs a
    WHERE NOT EXISTS (SELECT 1 FROM public.properties_v2 v WHERE v.id = a.property_id)
      AND NOT EXISTS (SELECT 1 FROM tmp_property_id_remap r WHERE r.v1_id = a.property_id)
  )
  SELECT COUNT(*),
         string_agg(tbl || '.id=' || row_id || ' (property_id=' || property_id || ')', '; ' ORDER BY tbl, row_id)
    INTO unresolved_count, sample
    FROM (SELECT * FROM unresolved LIMIT 5) s;

  IF unresolved_count > 0 THEN
    RAISE EXCEPTION 'BRIDGE INCOMPLETE: % unresolvable property_id values in passport stack. First 5: %', unresolved_count, sample;
  END IF;
  RAISE NOTICE 'BRIDGE COMPLETE: all passport-stack property_id values map to properties_v2.';
END $$;

-- 4. RLS LOCKSTEP — drop the 10 V1-joining policies BEFORE dropping FKs/UPDATEing
-- (so the UPDATE doesn't trip a policy mid-swap). Recreated post-swap below.

-- Sanity: assert exactly the expected 10 policies exist; abort if any extras appear.
DO $$
DECLARE
  expected text[] := ARRAY[
    'passport_autofill_suggestions|Users can delete suggestions for their org properties',
    'passport_autofill_suggestions|Users can insert suggestions for their org properties',
    'passport_autofill_suggestions|Users can update suggestions for their org properties',
    'passport_autofill_suggestions|Users can view suggestions for their org properties',
    'passport_field_audit|Users can insert audit for their org properties',
    'passport_field_audit|Users can view audit for their org properties',
    'property_title_numbers|Users can delete title numbers for their org properties',
    'property_title_numbers|Users can insert title numbers for their org properties',
    'property_title_numbers|Users can update title numbers for their org properties',
    'property_title_numbers|Users can view title numbers for their org properties'
  ];
  actual text[];
  extras text[];
  missing text[];
BEGIN
  SELECT array_agg(tablename || '|' || policyname ORDER BY tablename, policyname)
    INTO actual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('passport_autofill_suggestions','passport_field_audit','property_title_numbers');
  SELECT array_agg(p) INTO extras  FROM unnest(actual)   p WHERE p <> ALL(expected);
  SELECT array_agg(p) INTO missing FROM unnest(expected) p WHERE p <> ALL(actual);
  IF extras IS NOT NULL THEN
    RAISE EXCEPTION 'UNEXPECTED RLS POLICIES on passport-stack tables — aborting: %', extras;
  END IF;
  IF missing IS NOT NULL THEN
    RAISE NOTICE 'MISSING expected policies (will skip recreate for these): %', missing;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can delete suggestions for their org properties" ON public.passport_autofill_suggestions;
DROP POLICY IF EXISTS "Users can insert suggestions for their org properties" ON public.passport_autofill_suggestions;
DROP POLICY IF EXISTS "Users can update suggestions for their org properties" ON public.passport_autofill_suggestions;
DROP POLICY IF EXISTS "Users can view suggestions for their org properties"   ON public.passport_autofill_suggestions;

DROP POLICY IF EXISTS "Users can insert audit for their org properties" ON public.passport_field_audit;
DROP POLICY IF EXISTS "Users can view audit for their org properties"   ON public.passport_field_audit;

DROP POLICY IF EXISTS "Users can delete title numbers for their org properties" ON public.property_title_numbers;
DROP POLICY IF EXISTS "Users can insert title numbers for their org properties" ON public.property_title_numbers;
DROP POLICY IF EXISTS "Users can update title numbers for their org properties" ON public.property_title_numbers;
DROP POLICY IF EXISTS "Users can view title numbers for their org properties"   ON public.property_title_numbers;

-- 5. Drop V1-pointing FKs
ALTER TABLE public.passport_autofill_suggestions DROP CONSTRAINT IF EXISTS passport_autofill_suggestions_property_id_fkey;
ALTER TABLE public.passport_field_audit          DROP CONSTRAINT IF EXISTS passport_field_audit_property_id_fkey;
ALTER TABLE public.property_title_numbers        DROP CONSTRAINT IF EXISTS property_title_numbers_property_id_fkey;

-- 6. Backfill via bridge (only rows whose property_id still points at V1)
DO $$
DECLARE n int;
BEGIN
  UPDATE public.passport_autofill_suggestions x
     SET property_id = r.v2_id
    FROM tmp_property_id_remap r
   WHERE x.property_id = r.v1_id
     AND x.property_id <> r.v2_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'BACKFILL passport_autofill_suggestions: % rows', n;

  UPDATE public.passport_field_audit x
     SET property_id = r.v2_id
    FROM tmp_property_id_remap r
   WHERE x.property_id = r.v1_id
     AND x.property_id <> r.v2_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'BACKFILL passport_field_audit: % rows', n;

  UPDATE public.property_title_numbers x
     SET property_id = r.v2_id
    FROM tmp_property_id_remap r
   WHERE x.property_id = r.v1_id
     AND x.property_id <> r.v2_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'BACKFILL property_title_numbers: % rows', n;
END $$;

-- 7. Post-flight: drift must be 0 per FK
DO $$
DECLARE d_pas int; d_pfa int; d_ptn int;
BEGIN
  SELECT COUNT(*) INTO d_pas FROM public.passport_autofill_suggestions x
    WHERE x.property_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.properties_v2 v WHERE v.id = x.property_id);
  SELECT COUNT(*) INTO d_pfa FROM public.passport_field_audit x
    WHERE x.property_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.properties_v2 v WHERE v.id = x.property_id);
  SELECT COUNT(*) INTO d_ptn FROM public.property_title_numbers x
    WHERE x.property_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.properties_v2 v WHERE v.id = x.property_id);
  IF d_pas + d_pfa + d_ptn > 0 THEN
    RAISE EXCEPTION 'POST-FLIGHT DRIFT NON-ZERO: pas=%, pfa=%, ptn=%', d_pas, d_pfa, d_ptn;
  END IF;
  RAISE NOTICE 'POST-FLIGHT DRIFT: all 0 ✓';
END $$;

-- 8. Add new FKs → properties_v2(id) ON DELETE CASCADE (preserved)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'passport_autofill_suggestions_property_id_fkey') THEN
    ALTER TABLE public.passport_autofill_suggestions
      ADD CONSTRAINT passport_autofill_suggestions_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'passport_field_audit_property_id_fkey') THEN
    ALTER TABLE public.passport_field_audit
      ADD CONSTRAINT passport_field_audit_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_title_numbers_property_id_fkey') THEN
    ALTER TABLE public.property_title_numbers
      ADD CONSTRAINT property_title_numbers_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 9. Recreate the 10 RLS policies — same names, same scope, joining properties_v2

-- passport_autofill_suggestions (4)
CREATE POLICY "Users can view suggestions for their org properties"
  ON public.passport_autofill_suggestions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.properties_v2 p
                  WHERE p.id = passport_autofill_suggestions.property_id
                    AND user_has_org_access(p.org_id)));

CREATE POLICY "Users can insert suggestions for their org properties"
  ON public.passport_autofill_suggestions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties_v2 p
                       WHERE p.id = passport_autofill_suggestions.property_id
                         AND user_has_org_access(p.org_id)));

CREATE POLICY "Users can update suggestions for their org properties"
  ON public.passport_autofill_suggestions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.properties_v2 p
                  WHERE p.id = passport_autofill_suggestions.property_id
                    AND user_has_org_access(p.org_id)));

CREATE POLICY "Users can delete suggestions for their org properties"
  ON public.passport_autofill_suggestions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.properties_v2 p
                  WHERE p.id = passport_autofill_suggestions.property_id
                    AND user_has_org_access(p.org_id)));

-- passport_field_audit (2)
CREATE POLICY "Users can view audit for their org properties"
  ON public.passport_field_audit FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.properties_v2 p
                  WHERE p.id = passport_field_audit.property_id
                    AND user_has_org_access(p.org_id)));

CREATE POLICY "Users can insert audit for their org properties"
  ON public.passport_field_audit FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties_v2 p
                       WHERE p.id = passport_field_audit.property_id
                         AND user_has_org_access(p.org_id)));

-- property_title_numbers (4)
CREATE POLICY "Users can view title numbers for their org properties"
  ON public.property_title_numbers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.properties_v2 p
                  WHERE p.id = property_title_numbers.property_id
                    AND user_has_org_access(p.org_id)));

CREATE POLICY "Users can insert title numbers for their org properties"
  ON public.property_title_numbers FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties_v2 p
                       WHERE p.id = property_title_numbers.property_id
                         AND user_has_org_access(p.org_id)));

CREATE POLICY "Users can update title numbers for their org properties"
  ON public.property_title_numbers FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.properties_v2 p
                  WHERE p.id = property_title_numbers.property_id
                    AND user_has_org_access(p.org_id)));

CREATE POLICY "Users can delete title numbers for their org properties"
  ON public.property_title_numbers FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.properties_v2 p
                  WHERE p.id = property_title_numbers.property_id
                    AND user_has_org_access(p.org_id)));

COMMIT;