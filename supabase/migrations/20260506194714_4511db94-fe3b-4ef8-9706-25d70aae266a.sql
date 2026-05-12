-- @allow-v1-refs: pre-cutover historical migration referencing §0a V1 tables (loans/tenancies/costs/income); baked-in DB history, not new code.
-- V1 income → V2 property_income_budgets_v2: create, backfill, freeze, drop V1.
-- Mirrors the costs A–E pattern (Prompts #49a–#49e) with lessons baked in:
--   * NO FK on org_id → legal_entities (org_id is tenant boundary, RLS-enforced)
--   * RLS via user_has_org_access(org_id) (mirror property_cost_budgets_v2 post-#49d-fix)
--   * tax_year text (UK starting-year rule: V1 year=YYYY → V2 'YYYY/(YY+1)')

-- 1. Create V2 table
CREATE TABLE IF NOT EXISTS public.property_income_budgets_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  property_id uuid NOT NULL REFERENCES public.properties_v2(id) ON DELETE CASCADE,
  tax_year text NOT NULL,
  annual_rent_gbp numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (property_id, tax_year)
);

-- 2. updated_at trigger
DROP TRIGGER IF EXISTS trg_property_income_budgets_v2_updated_at ON public.property_income_budgets_v2;
CREATE TRIGGER trg_property_income_budgets_v2_updated_at
BEFORE UPDATE ON public.property_income_budgets_v2
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RLS
ALTER TABLE public.property_income_budgets_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "property_income_budgets_v2_select" ON public.property_income_budgets_v2;
CREATE POLICY "property_income_budgets_v2_select"
ON public.property_income_budgets_v2 FOR SELECT
USING (public.user_has_org_access(org_id));

DROP POLICY IF EXISTS "property_income_budgets_v2_insert" ON public.property_income_budgets_v2;
CREATE POLICY "property_income_budgets_v2_insert"
ON public.property_income_budgets_v2 FOR INSERT
WITH CHECK (public.user_has_org_access(org_id));

DROP POLICY IF EXISTS "property_income_budgets_v2_update" ON public.property_income_budgets_v2;
CREATE POLICY "property_income_budgets_v2_update"
ON public.property_income_budgets_v2 FOR UPDATE
USING (public.user_has_org_access(org_id))
WITH CHECK (public.user_has_org_access(org_id));

DROP POLICY IF EXISTS "property_income_budgets_v2_delete" ON public.property_income_budgets_v2;
CREATE POLICY "property_income_budgets_v2_delete"
ON public.property_income_budgets_v2 FOR DELETE
USING (public.user_has_org_access(org_id));

-- 4. Backfill V1 → V2 with parity assertion
DO $$
DECLARE
  v_v1_count int;
  v_v2_count int;
BEGIN
  SELECT count(*) INTO v_v1_count FROM public.income;

  INSERT INTO public.property_income_budgets_v2 (
    org_id, property_id, tax_year, annual_rent_gbp, created_at, updated_at
  )
  SELECT
    p2.org_id,
    p2.id,
    format('%s/%s', i.year, lpad(((i.year + 1) % 100)::text, 2, '0')),
    i.annual_rent_gbp,
    i.created_at,
    i.updated_at
  FROM public.income i
  JOIN public.properties p ON p.id = i.property_id
  JOIN public.properties_v2 p2
    ON lower(trim(p2.address_line_1)) = lower(trim(p.address_line))
  ON CONFLICT (property_id, tax_year) DO NOTHING;

  SELECT count(*) INTO v_v2_count FROM public.property_income_budgets_v2;
  IF v_v2_count <> v_v1_count THEN
    RAISE EXCEPTION 'Income backfill mismatch: V1=% V2=%', v_v1_count, v_v2_count;
  END IF;
END $$;

-- 5. Install v1_freeze_guard on public.income before drop (defensive in case
--    drop is delayed; idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'v1_freeze_guard' AND tgrelid = 'public.income'::regclass
  ) THEN
    CREATE TRIGGER v1_freeze_guard
    BEFORE INSERT OR UPDATE OR DELETE ON public.income
    FOR EACH ROW EXECUTE FUNCTION public.v1_freeze_guard();
  END IF;
END $$;

-- 6. Drop V1 income (per #32 audit: 0 inbound FKs, safe to drop immediately).
DROP TABLE IF EXISTS public.income CASCADE;
