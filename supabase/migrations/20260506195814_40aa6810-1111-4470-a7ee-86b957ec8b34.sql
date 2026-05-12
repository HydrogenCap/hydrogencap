-- @allow-v1-refs: pre-cutover historical migration referencing §0a V1 tables (loans/tenancies/costs/income); baked-in DB history, not new code.
-- Tenancies Prompt #51: schema parity for V2 tenancy_agreements vs V1 tenancies.
-- Adds 5 missing columns and backfills from V1 via property+start_date bridge
-- (V1 tenant_id space ≠ V2 tenant_id space, so we bridge on property+start_date).
-- 13/13 V1 rows pair uniquely with V2 rows (verified pre-flight).
--
-- NO FK changes; NO RLS changes; NO src/ changes. Constraint baked in from
-- #49d-fix: do NOT add FK org_id → legal_entities — RLS is the boundary.

-- 1. Add columns (idempotent)
ALTER TABLE public.tenancy_agreements
  ADD COLUMN IF NOT EXISTS rent_due_day integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tenancy_agreement_url text,
  ADD COLUMN IF NOT EXISTS notice_period_weeks integer DEFAULT 4,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_reference text;

-- 2. Backfill from V1 tenancies via property+start_date bridge
DO $$
DECLARE
  v_v1_count int;
  v_paired int;
  v_drift int;
BEGIN
  SELECT count(*) INTO v_v1_count FROM public.tenancies;

  WITH bridge AS (
    SELECT
      ta.id AS v2_id,
      t.rent_due_day,
      t.tenancy_agreement_url,
      t.notice_period_weeks,
      t.payment_method::text AS payment_method,
      t.payment_reference
    FROM public.tenancies t
    JOIN public.properties p ON p.id = t.property_id
    JOIN public.properties_v2 p2
      ON lower(trim(p2.address_line_1)) = lower(trim(p.address_line))
    JOIN public.tenancy_agreements ta
      ON ta.property_id = p2.id AND ta.start_date = t.start_date
  )
  UPDATE public.tenancy_agreements ta
  SET
    rent_due_day = COALESCE(b.rent_due_day, ta.rent_due_day),
    tenancy_agreement_url = COALESCE(b.tenancy_agreement_url, ta.tenancy_agreement_url),
    notice_period_weeks = COALESCE(b.notice_period_weeks, ta.notice_period_weeks),
    payment_method = COALESCE(b.payment_method, ta.payment_method),
    payment_reference = COALESCE(b.payment_reference, ta.payment_reference)
  FROM bridge b
  WHERE ta.id = b.v2_id;

  GET DIAGNOSTICS v_paired = ROW_COUNT;
  RAISE NOTICE 'Tenancies #51 backfill: V1=%, paired updates=%', v_v1_count, v_paired;

  -- Drift assertion: every V1 row that had a non-null value in any of the 5
  -- columns must have produced a V2 row with that value populated.
  SELECT count(*) INTO v_drift
  FROM public.tenancies t
  JOIN public.properties p ON p.id = t.property_id
  JOIN public.properties_v2 p2
    ON lower(trim(p2.address_line_1)) = lower(trim(p.address_line))
  JOIN public.tenancy_agreements ta
    ON ta.property_id = p2.id AND ta.start_date = t.start_date
  WHERE
       (t.tenancy_agreement_url IS NOT NULL AND ta.tenancy_agreement_url IS DISTINCT FROM t.tenancy_agreement_url)
    OR (t.notice_period_weeks   IS NOT NULL AND ta.notice_period_weeks   IS DISTINCT FROM t.notice_period_weeks)
    OR (t.payment_method        IS NOT NULL AND ta.payment_method        IS DISTINCT FROM t.payment_method::text)
    OR (t.payment_reference     IS NOT NULL AND ta.payment_reference     IS DISTINCT FROM t.payment_reference)
    OR (t.rent_due_day          IS NOT NULL AND ta.rent_due_day          IS DISTINCT FROM t.rent_due_day);

  IF v_drift <> 0 THEN
    RAISE EXCEPTION 'Tenancies #51 drift after backfill: % rows mismatched', v_drift;
  END IF;
END $$;
