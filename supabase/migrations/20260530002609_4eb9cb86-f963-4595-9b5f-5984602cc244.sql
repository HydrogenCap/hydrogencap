-- Fix 4 Error-level RLS findings (idempotent)

-- 1. Investor reports storage: scope ir_upload / ir_delete to org members
DROP POLICY IF EXISTS ir_upload ON storage.objects;
DROP POLICY IF EXISTS ir_delete ON storage.objects;

CREATE POLICY ir_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'investor-reports'
  AND public.user_has_org_access(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY ir_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'investor-reports'
  AND public.user_can_access_investor_report(name)
);

-- 2. Floorplans storage: drop overly-permissive UPDATE policy
-- (correctly-scoped "Org members can update floorplans" already exists)
DROP POLICY IF EXISTS "Users can update their floorplans" ON storage.objects;

-- 3. payment_reminders: fix broken self-referential subquery
DROP POLICY IF EXISTS "Users can view payment reminders for their org"   ON public.payment_reminders;
DROP POLICY IF EXISTS "Users can create payment reminders for their org" ON public.payment_reminders;
DROP POLICY IF EXISTS "Users can update payment reminders for their org" ON public.payment_reminders;
DROP POLICY IF EXISTS "Users can delete payment reminders for their org" ON public.payment_reminders;
DROP POLICY IF EXISTS "Org members can view payment reminders"   ON public.payment_reminders;
DROP POLICY IF EXISTS "Org members can create payment reminders" ON public.payment_reminders;
DROP POLICY IF EXISTS "Org members can update payment reminders" ON public.payment_reminders;
DROP POLICY IF EXISTS "Org members can delete payment reminders" ON public.payment_reminders;

CREATE POLICY "Org members can view payment reminders"
  ON public.payment_reminders FOR SELECT TO authenticated
  USING (public.user_has_org_access(org_id));
CREATE POLICY "Org members can create payment reminders"
  ON public.payment_reminders FOR INSERT TO authenticated
  WITH CHECK (public.user_has_org_access(org_id));
CREATE POLICY "Org members can update payment reminders"
  ON public.payment_reminders FOR UPDATE TO authenticated
  USING (public.user_has_org_access(org_id))
  WITH CHECK (public.user_has_org_access(org_id));
CREATE POLICY "Org members can delete payment reminders"
  ON public.payment_reminders FOR DELETE TO authenticated
  USING (public.user_has_org_access(org_id));

-- 4. tax_expenses: same broken pattern, same fix
DROP POLICY IF EXISTS "Users can view own org tax_expenses"   ON public.tax_expenses;
DROP POLICY IF EXISTS "Users can insert own org tax_expenses" ON public.tax_expenses;
DROP POLICY IF EXISTS "Users can update own org tax_expenses" ON public.tax_expenses;
DROP POLICY IF EXISTS "Users can delete own org tax_expenses" ON public.tax_expenses;
DROP POLICY IF EXISTS "Org members can view tax_expenses"     ON public.tax_expenses;
DROP POLICY IF EXISTS "Org members can insert tax_expenses"   ON public.tax_expenses;
DROP POLICY IF EXISTS "Org members can update tax_expenses"   ON public.tax_expenses;
DROP POLICY IF EXISTS "Org members can delete tax_expenses"   ON public.tax_expenses;

CREATE POLICY "Org members can view tax_expenses"
  ON public.tax_expenses FOR SELECT TO authenticated
  USING (public.user_has_org_access(org_id));
CREATE POLICY "Org members can insert tax_expenses"
  ON public.tax_expenses FOR INSERT TO authenticated
  WITH CHECK (public.user_has_org_access(org_id));
CREATE POLICY "Org members can update tax_expenses"
  ON public.tax_expenses FOR UPDATE TO authenticated
  USING (public.user_has_org_access(org_id))
  WITH CHECK (public.user_has_org_access(org_id));
CREATE POLICY "Org members can delete tax_expenses"
  ON public.tax_expenses FOR DELETE TO authenticated
  USING (public.user_has_org_access(org_id));