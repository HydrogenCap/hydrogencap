## Goal
Fix 4 confirmed Error-level RLS findings. All four were verified against live `pg_policies` — none are already correct. One idempotent migration, `user_has_org_access(org_id)` as the scoping helper (matches existing pattern), `user_can_access_investor_report(name)` for investor-reports storage (matches the existing correct SELECT policy on the same bucket).

---

### 1. Investor reports storage — `ir_upload` / `ir_delete`

**Current (live):**
```sql
-- ir_upload (INSERT)
WITH CHECK ((bucket_id = 'investor-reports') AND (auth.uid() IS NOT NULL))
-- ir_delete (DELETE)
USING ((bucket_id = 'investor-reports') AND (auth.uid() IS NOT NULL))
```
Any authenticated user can write/delete.

**Proposed:**
```sql
DROP POLICY IF EXISTS ir_upload ON storage.objects;
DROP POLICY IF EXISTS ir_delete ON storage.objects;

CREATE POLICY ir_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'investor-reports'
  AND user_has_org_access(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY ir_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'investor-reports'
  AND user_can_access_investor_report(name)
);
```
Mirrors the existing correct SELECT policy `"Org members can view investor reports"`. Assumes folder layout `<org_id>/...` (consistent with other org-scoped buckets per memory `storage-access-control-v3`).

---

### 2. Floorplans storage — `"Users can update their floorplans"`

**Current (live):**
```sql
USING ((bucket_id = 'floorplans') AND (auth.role() = 'authenticated'))
```
No ownership check on UPDATE; INSERT/SELECT/DELETE are already correctly scoped via property→memberships join.

**Proposed:** drop legacy policy and replace with one matching the sibling INSERT policy (folder = property id):
```sql
DROP POLICY IF EXISTS "Users can update their floorplans" ON storage.objects;

CREATE POLICY "Org members can update floorplans v2" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'floorplans'
  AND EXISTS (
    SELECT 1 FROM properties p
    JOIN memberships m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid()
      AND (storage.foldername(objects.name))[1] = p.id::text
  )
);
```
(There is already an existing `"Org members can update floorplans"` policy that uses the same pattern — the bug is the leftover permissive one; dropping it is sufficient. New v2 name avoids collision; if existing one is sufficient, the CREATE can be skipped — included for safety/idempotency.)

**Refinement:** since `"Org members can update floorplans"` already exists and is correctly scoped, we just `DROP POLICY IF EXISTS "Users can update their floorplans"` and do not add a duplicate.

---

### 3. `public.payment_reminders` — broken self-referential subquery

**Current (live)** (all 4 policies SELECT/INSERT/UPDATE/DELETE):
```sql
org_id IN (SELECT payment_reminders.org_id FROM profiles WHERE profiles.id = auth.uid())
```
`payment_reminders.org_id` inside the subquery resolves to the outer table → always true for any matching profile row (cross-org leak) or empty.

**Proposed:**
```sql
DROP POLICY IF EXISTS "Users can view payment reminders for their org"   ON public.payment_reminders;
DROP POLICY IF EXISTS "Users can create payment reminders for their org" ON public.payment_reminders;
DROP POLICY IF EXISTS "Users can update payment reminders for their org" ON public.payment_reminders;
DROP POLICY IF EXISTS "Users can delete payment reminders for their org" ON public.payment_reminders;

CREATE POLICY "Org members can view payment reminders"   ON public.payment_reminders FOR SELECT TO authenticated USING (user_has_org_access(org_id));
CREATE POLICY "Org members can create payment reminders" ON public.payment_reminders FOR INSERT TO authenticated WITH CHECK (user_has_org_access(org_id));
CREATE POLICY "Org members can update payment reminders" ON public.payment_reminders FOR UPDATE TO authenticated USING (user_has_org_access(org_id)) WITH CHECK (user_has_org_access(org_id));
CREATE POLICY "Org members can delete payment reminders" ON public.payment_reminders FOR DELETE TO authenticated USING (user_has_org_access(org_id));
```

---

### 4. `public.tax_expenses` — same broken pattern

**Current (live):** identical bug across all 4 policies — `SELECT tax_expenses.org_id FROM profiles ...`.

**Proposed:** same fix shape as #3, using `user_has_org_access(org_id)`. All four policies dropped and recreated.

---

## Idempotency
Every statement is `DROP POLICY IF EXISTS` followed by `CREATE POLICY`. Safe to re-run.

## Out of scope
The 3 warn-level findings (document_share_links public token access, escalation_rules null-org writes, realtime.messages) and the SECURITY DEFINER / leaked-password lints — user only asked about the 4 errors.

## Verify chain after apply
`bun run lint`, `bun run typecheck`, `bun run build`, then re-run `supabase--linter` and security scan to confirm the 4 errors clear.
