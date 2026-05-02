
BEGIN;

-- Class-B company-keyed 4-FK batch (Prompt #40, retry)
-- Drop OLD V1-pointing FK BEFORE backfill so UPDATE doesn't trip the old constraint.

CREATE TEMP TABLE tmp_company_id_remap (
  v1_id uuid PRIMARY KEY,
  v2_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_company_id_remap (v1_id, v2_id)
SELECT c.id, le.id
FROM public.companies c
JOIN public.legal_entities le ON le.company_number = c.company_number
WHERE c.company_number IS NOT NULL
  AND le.company_number IS NOT NULL;

-- Bridge-completeness assertion
DO $$
DECLARE v_unresolved_count int; v_sample text;
BEGIN
  WITH unresolved AS (
    SELECT 'documents'::text AS t, id::text AS row_id, company_id AS v1_id
      FROM public.documents WHERE company_id IS NOT NULL
        AND company_id NOT IN (SELECT v1_id FROM tmp_company_id_remap)
    UNION ALL
    SELECT 'shareholdings', id::text, company_id FROM public.shareholdings
      WHERE company_id IS NOT NULL
        AND company_id NOT IN (SELECT v1_id FROM tmp_company_id_remap)
    UNION ALL
    SELECT 'property_beneficial_owners', id::text, company_id FROM public.property_beneficial_owners
      WHERE company_id IS NOT NULL
        AND company_id NOT IN (SELECT v1_id FROM tmp_company_id_remap)
    UNION ALL
    SELECT 'property_legal_ownership', id::text, owning_company_id FROM public.property_legal_ownership
      WHERE owning_company_id IS NOT NULL
        AND owning_company_id NOT IN (SELECT v1_id FROM tmp_company_id_remap)
  )
  SELECT COUNT(*), string_agg(t || '.' || row_id || ' -> ' || v1_id::text, '; ')
    INTO v_unresolved_count, v_sample
    FROM (SELECT * FROM unresolved LIMIT 5) s;
  IF v_unresolved_count > 0 THEN
    RAISE EXCEPTION 'Bridge incomplete: % unresolvable. First 5: %', v_unresolved_count, v_sample;
  END IF;
  RAISE NOTICE 'Bridge complete: 0 unresolved across 4 from-columns';
END $$;

-- ============================================================
-- documents.company_id  (CASCADE)
-- ============================================================
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_company_id_fkey;

DO $$
DECLARE v_drift int; v_backfilled int;
BEGIN
  SELECT COUNT(*) INTO v_drift FROM public.documents d
    WHERE company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.legal_entities le WHERE le.id = d.company_id);
  RAISE NOTICE 'documents.company_id preflight drift: %', v_drift;

  UPDATE public.documents d SET company_id = r.v2_id
    FROM tmp_company_id_remap r WHERE d.company_id = r.v1_id;
  GET DIAGNOSTICS v_backfilled = ROW_COUNT;
  RAISE NOTICE 'documents.company_id rows backfilled: %', v_backfilled;

  SELECT COUNT(*) INTO v_drift FROM public.documents d
    WHERE company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.legal_entities le WHERE le.id = d.company_id);
  IF v_drift <> 0 THEN
    RAISE EXCEPTION 'documents.company_id post-flight drift: % (expected 0)', v_drift;
  END IF;
END $$;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.legal_entities(id) ON DELETE CASCADE;

-- ============================================================
-- shareholdings.company_id  (CASCADE) + 4 RLS policy rewrites
-- ============================================================
DROP POLICY IF EXISTS "Users can view shareholdings in their org" ON public.shareholdings;
DROP POLICY IF EXISTS "Users can insert shareholdings in their org" ON public.shareholdings;
DROP POLICY IF EXISTS "Users can update shareholdings in their org" ON public.shareholdings;
DROP POLICY IF EXISTS "Users can delete shareholdings in their org" ON public.shareholdings;

ALTER TABLE public.shareholdings DROP CONSTRAINT IF EXISTS shareholdings_company_id_fkey;

DO $$
DECLARE v_drift int; v_backfilled int;
BEGIN
  SELECT COUNT(*) INTO v_drift FROM public.shareholdings s
    WHERE company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.legal_entities le WHERE le.id = s.company_id);
  RAISE NOTICE 'shareholdings.company_id preflight drift: %', v_drift;

  UPDATE public.shareholdings s SET company_id = r.v2_id
    FROM tmp_company_id_remap r WHERE s.company_id = r.v1_id;
  GET DIAGNOSTICS v_backfilled = ROW_COUNT;
  RAISE NOTICE 'shareholdings.company_id rows backfilled: %', v_backfilled;

  SELECT COUNT(*) INTO v_drift FROM public.shareholdings s
    WHERE company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.legal_entities le WHERE le.id = s.company_id);
  IF v_drift <> 0 THEN
    RAISE EXCEPTION 'shareholdings.company_id post-flight drift: % (expected 0)', v_drift;
  END IF;
END $$;

ALTER TABLE public.shareholdings
  ADD CONSTRAINT shareholdings_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.legal_entities(id) ON DELETE CASCADE;

CREATE POLICY "Users can view shareholdings in their org" ON public.shareholdings
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.legal_entities le
    WHERE le.id = shareholdings.company_id AND user_has_org_access(le.org_id)
  ));
CREATE POLICY "Users can insert shareholdings in their org" ON public.shareholdings
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.legal_entities le
    WHERE le.id = shareholdings.company_id AND user_has_org_access(le.org_id)
  ));
CREATE POLICY "Users can update shareholdings in their org" ON public.shareholdings
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.legal_entities le
    WHERE le.id = shareholdings.company_id AND user_has_org_access(le.org_id)
  ));
CREATE POLICY "Users can delete shareholdings in their org" ON public.shareholdings
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.legal_entities le
    WHERE le.id = shareholdings.company_id AND user_has_org_access(le.org_id)
  ));

-- ============================================================
-- property_beneficial_owners.company_id  (CASCADE)
-- ============================================================
ALTER TABLE public.property_beneficial_owners DROP CONSTRAINT IF EXISTS property_beneficial_owners_company_id_fkey;

DO $$
DECLARE v_drift int; v_backfilled int;
BEGIN
  SELECT COUNT(*) INTO v_drift FROM public.property_beneficial_owners p
    WHERE company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.legal_entities le WHERE le.id = p.company_id);
  RAISE NOTICE 'property_beneficial_owners.company_id preflight drift: %', v_drift;

  UPDATE public.property_beneficial_owners p SET company_id = r.v2_id
    FROM tmp_company_id_remap r WHERE p.company_id = r.v1_id;
  GET DIAGNOSTICS v_backfilled = ROW_COUNT;
  RAISE NOTICE 'property_beneficial_owners.company_id rows backfilled: %', v_backfilled;

  SELECT COUNT(*) INTO v_drift FROM public.property_beneficial_owners p
    WHERE company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.legal_entities le WHERE le.id = p.company_id);
  IF v_drift <> 0 THEN
    RAISE EXCEPTION 'property_beneficial_owners.company_id post-flight drift: % (expected 0)', v_drift;
  END IF;
END $$;

ALTER TABLE public.property_beneficial_owners
  ADD CONSTRAINT property_beneficial_owners_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.legal_entities(id) ON DELETE CASCADE;

-- ============================================================
-- property_legal_ownership.owning_company_id  (SET NULL)
-- ============================================================
ALTER TABLE public.property_legal_ownership DROP CONSTRAINT IF EXISTS property_legal_ownership_owning_company_id_fkey;

DO $$
DECLARE v_drift int; v_backfilled int;
BEGIN
  SELECT COUNT(*) INTO v_drift FROM public.property_legal_ownership p
    WHERE owning_company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.legal_entities le WHERE le.id = p.owning_company_id);
  RAISE NOTICE 'property_legal_ownership.owning_company_id preflight drift: %', v_drift;

  UPDATE public.property_legal_ownership p SET owning_company_id = r.v2_id
    FROM tmp_company_id_remap r WHERE p.owning_company_id = r.v1_id;
  GET DIAGNOSTICS v_backfilled = ROW_COUNT;
  RAISE NOTICE 'property_legal_ownership.owning_company_id rows backfilled: %', v_backfilled;

  SELECT COUNT(*) INTO v_drift FROM public.property_legal_ownership p
    WHERE owning_company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.legal_entities le WHERE le.id = p.owning_company_id);
  IF v_drift <> 0 THEN
    RAISE EXCEPTION 'property_legal_ownership.owning_company_id post-flight drift: % (expected 0)', v_drift;
  END IF;
END $$;

ALTER TABLE public.property_legal_ownership
  ADD CONSTRAINT property_legal_ownership_owning_company_id_fkey
  FOREIGN KEY (owning_company_id) REFERENCES public.legal_entities(id) ON DELETE SET NULL;

COMMIT;
