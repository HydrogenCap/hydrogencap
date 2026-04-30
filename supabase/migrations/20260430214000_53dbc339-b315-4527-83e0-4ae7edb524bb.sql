-- Class-A FK re-point (v2 attempt — drop FK before backfill so we can write V2 ids)
-- Audit: docs/release/v1-v2-fk-drift-2026-04-30.md §5.1
-- Bridge column: company_number (audit said companies_house_number; actual is company_number).
BEGIN;

-- RLS guard
DO $$
DECLARE v_rls_hits int;
BEGIN
  SELECT count(*) INTO v_rls_hits FROM pg_policies
  WHERE schemaname='public'
    AND (coalesce(qual,'') ILIKE '%legal_owner_company_id%'
      OR coalesce(with_check,'') ILIKE '%legal_owner_company_id%');
  IF v_rls_hits > 0 THEN
    RAISE EXCEPTION 'Aborting: % RLS policies reference legal_owner_company_id', v_rls_hits;
  END IF;
END $$;

-- Pre-flight drift count
DO $$
DECLARE v_drift int;
BEGIN
  SELECT count(*) INTO v_drift FROM public.properties_v2
  WHERE legal_owner_company_id IS NOT NULL
    AND legal_owner_company_id NOT IN (SELECT id FROM public.legal_entities);
  RAISE NOTICE 'Pre-flight drift count: %', v_drift;
END $$;

-- Drop the old FK first so the backfill (which writes V2 ids not present in V1 companies)
-- doesn't trip the existing constraint.
ALTER TABLE public.properties_v2
  DROP CONSTRAINT IF EXISTS properties_v2_legal_owner_company_id_fkey;

-- Build bridge + backfill + verify
DO $$
DECLARE
  v_drift int;
  v_unresolvable int;
  v_backfilled int;
  v_post_drift int;
  v_unresolved_sample text;
BEGIN
  SELECT count(*) INTO v_drift FROM public.properties_v2
  WHERE legal_owner_company_id IS NOT NULL
    AND legal_owner_company_id NOT IN (SELECT id FROM public.legal_entities);

  IF v_drift = 0 THEN
    RAISE NOTICE 'No drift — skipping remap.';
  ELSE
    CREATE TEMP TABLE tmp_company_id_remap (
      v1_id uuid PRIMARY KEY,
      v2_id uuid NOT NULL
    ) ON COMMIT DROP;

    INSERT INTO tmp_company_id_remap (v1_id, v2_id)
    SELECT c.id, le.id
    FROM public.companies c
    JOIN public.legal_entities le ON le.company_number = c.company_number
    WHERE c.company_number IS NOT NULL AND le.company_number IS NOT NULL;

    SELECT count(*) INTO v_unresolvable
    FROM public.properties_v2 p
    WHERE p.legal_owner_company_id IS NOT NULL
      AND p.legal_owner_company_id NOT IN (SELECT v1_id FROM tmp_company_id_remap);
    IF v_unresolvable > 0 THEN
      SELECT string_agg(format('(%s, %s)', id, legal_owner_company_id), '; ')
        INTO v_unresolved_sample
      FROM (
        SELECT id, legal_owner_company_id FROM public.properties_v2
        WHERE legal_owner_company_id IS NOT NULL
          AND legal_owner_company_id NOT IN (SELECT v1_id FROM tmp_company_id_remap)
        LIMIT 5
      ) p;
      RAISE EXCEPTION 'Bridge incomplete: % unresolvable rows. First 5: %', v_unresolvable, v_unresolved_sample;
    END IF;

    WITH upd AS (
      UPDATE public.properties_v2 p
      SET legal_owner_company_id = r.v2_id
      FROM tmp_company_id_remap r
      WHERE p.legal_owner_company_id = r.v1_id
      RETURNING 1
    )
    SELECT count(*) INTO v_backfilled FROM upd;
    RAISE NOTICE 'Rows backfilled: % (expected %)', v_backfilled, v_drift;

    SELECT count(*) INTO v_post_drift FROM public.properties_v2
    WHERE legal_owner_company_id IS NOT NULL
      AND legal_owner_company_id NOT IN (SELECT id FROM public.legal_entities);
    IF v_post_drift > 0 THEN
      RAISE EXCEPTION 'Post-backfill drift still %', v_post_drift;
    END IF;
    RAISE NOTICE 'Post-backfill drift: 0';
  END IF;
END $$;

-- Add the new FK against legal_entities
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'properties_v2_legal_owner_company_id_fkey'
  ) THEN
    ALTER TABLE public.properties_v2
      ADD CONSTRAINT properties_v2_legal_owner_company_id_fkey
      FOREIGN KEY (legal_owner_company_id)
      REFERENCES public.legal_entities(id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;