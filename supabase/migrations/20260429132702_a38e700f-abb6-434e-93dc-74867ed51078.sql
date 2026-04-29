-- Step 0: Drop the stale FK pointing at V1 public.companies (if present).
-- This was blocking the rebind in the prior attempt.
ALTER TABLE public.company_secrets
  DROP CONSTRAINT IF EXISTS company_secrets_company_id_fkey;

DO $$
DECLARE
  rec RECORD;
  v_total INT;
  v_in_v2 INT;
  v_still_in_v1 INT;
  v_updated INT;
BEGIN
  -- Step 1: Log the dry-run mapping for audit trail
  RAISE NOTICE '=== company_secrets V1 -> V2 rebind: dry-run mapping ===';
  FOR rec IN
    SELECT
      cs.company_id    AS old_v1_id,
      le.id            AS new_v2_id,
      c.company_number,
      c.legal_name     AS v1_name,
      le.entity_name   AS v2_name,
      cs.auth_code_last4,
      cs.utr_last4
    FROM public.company_secrets cs
    JOIN public.companies      c  ON c.id = cs.company_id
    JOIN public.legal_entities le ON le.company_number = c.company_number
                                 AND le.org_id         = c.org_id
    ORDER BY cs.updated_at DESC
  LOOP
    RAISE NOTICE 'MAP: % (%) -> % | CH#% | last4 auth=% utr=%',
      rec.v1_name, rec.old_v1_id, rec.new_v2_id, rec.company_number,
      COALESCE(rec.auth_code_last4, '-'), COALESCE(rec.utr_last4, '-');
  END LOOP;

  -- Step 2: Repoint company_id from V1 companies.id to V2 legal_entities.id
  -- Idempotent: after first run cs.company_id no longer exists in V1 companies,
  -- so the JOIN yields 0 rows and nothing is updated.
  WITH upd AS (
    UPDATE public.company_secrets cs
    SET    company_id = le.id,
           updated_at = now()
    FROM   public.companies c
    JOIN   public.legal_entities le
      ON   le.company_number = c.company_number
      AND  le.org_id         = c.org_id
    WHERE  cs.company_id = c.id
    RETURNING 1
  )
  SELECT count(*) INTO v_updated FROM upd;
  RAISE NOTICE 'UPDATED % company_secrets rows (0 expected on re-run)', v_updated;

  -- Step 3: Sanity check inside the same transaction
  SELECT
    count(*),
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.legal_entities le WHERE le.id = cs.company_id)),
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.companies      cc WHERE cc.id = cs.company_id))
  INTO v_total, v_in_v2, v_still_in_v1
  FROM public.company_secrets cs;

  RAISE NOTICE 'SANITY: total=%, in_v2=%, still_in_v1=%', v_total, v_in_v2, v_still_in_v1;

  IF v_total <> 10 THEN
    RAISE EXCEPTION 'company_secrets total row count is % (expected 10) — aborting', v_total;
  END IF;
  IF v_in_v2 <> 10 THEN
    RAISE EXCEPTION 'company_secrets rows resolving to legal_entities = % (expected 10) — aborting', v_in_v2;
  END IF;
  IF v_still_in_v1 > 0 THEN
    RAISE EXCEPTION 'company_secrets rows still pointing at V1 companies = % (expected 0) — aborting', v_still_in_v1;
  END IF;
END $$;

-- Step 4: Add the new FK pointing at V2 legal_entities so future drift is impossible.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema    = 'public'
      AND table_name      = 'company_secrets'
      AND constraint_name = 'company_secrets_company_id_fkey'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.company_secrets
      ADD CONSTRAINT company_secrets_company_id_fkey
      FOREIGN KEY (company_id)
      REFERENCES public.legal_entities(id)
      ON DELETE CASCADE;
    RAISE NOTICE 'FK company_secrets_company_id_fkey -> legal_entities ADDED';
  ELSE
    RAISE NOTICE 'FK company_secrets_company_id_fkey already exists — skipping';
  END IF;
END $$;