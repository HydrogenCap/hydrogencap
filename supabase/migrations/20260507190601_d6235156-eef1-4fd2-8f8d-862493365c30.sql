-- @allow-v1-refs: pre-cutover historical migration referencing §0a V1 tables (loans/tenancies/costs/income); baked-in DB history, not new code.
-- Costs F: drop V1 public.costs end-to-end.
-- Pre-flight (re-verified at apply time):
--   * 3 rows in 1 org, all backfilled to property_cost_budgets_v2 (#49d).
--   * 0 inbound FKs to public.costs (#49 audit re-verified via pg_constraint).
--   * 0 from('costs') refs in src/ or supabase/functions/ (#49b/#49c re-verified).
--   * Frozen since 2026-05-06 (#49e), no writes possible.

DROP TRIGGER IF EXISTS v1_freeze_guard ON public.costs;
DROP TRIGGER IF EXISTS set_costs_updated_at ON public.costs;

DROP POLICY IF EXISTS "Users can delete costs for their properties" ON public.costs;
DROP POLICY IF EXISTS "Users can insert costs for their properties" ON public.costs;
DROP POLICY IF EXISTS "Users can update costs for their properties" ON public.costs;
DROP POLICY IF EXISTS "Users can view costs for their properties" ON public.costs;

-- CASCADE will surface any FK we missed; #49 audit + pre-flight confirm none exist.
DROP TABLE public.costs CASCADE;