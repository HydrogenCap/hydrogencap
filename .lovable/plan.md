# Two remaining Error-level findings — fix plan

Both verified live. One idempotent migration covers both.

---

## Finding A — `platform_role_self_elevation` still flagged

### Why the trigger isn't enough
Trigger `guard_platform_role` is in place, but the scanner inspects *policies + grants*, not triggers. Live state on `public.profiles`:

- UPDATE policy `"Users can update own profile"` — PERMISSIVE, `USING / WITH CHECK auth.uid() = user_id`, **no column scope**. So PostgREST will accept a PATCH that includes `platform_role` / `role`.
- `authenticated` role has table-level UPDATE on `public.profiles` (Supabase default grants `SELECT,INSERT,UPDATE,DELETE` to `authenticated` once policies exist), with no column-level revoke. So at the privilege layer the columns are still writable.
- The trigger only rejects the statement at runtime — the policy/grant surface looks wide-open to a static analyzer (and a future trigger drop would silently re-open it).

### Fix — make the columns non-writable from the API
Defense in depth: keep the trigger, **plus** add a RESTRICTIVE update policy that blocks any UPDATE that changes `platform_role` or `role`, **plus** revoke column-level UPDATE from `anon` / `authenticated`. Service-role + admin RPCs are unaffected (service_role bypasses RLS, REVOKE applies only to listed roles).

```sql
-- 1. RESTRICTIVE policy — combines with AND, so it blocks even if the permissive self-update policy says yes
DROP POLICY IF EXISTS "Block role column self-update" ON public.profiles;
CREATE POLICY "Block role column self-update"
  ON public.profiles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    platform_role IS NOT DISTINCT FROM (SELECT p.platform_role FROM public.profiles p WHERE p.id = profiles.id)
    AND role        IS NOT DISTINCT FROM (SELECT p.role          FROM public.profiles p WHERE p.id = profiles.id)
  );

-- 2. Column-level grant revoke — scanner-visible privilege lockdown
REVOKE UPDATE (platform_role, role) ON public.profiles FROM authenticated;
REVOKE UPDATE (platform_role, role) ON public.profiles FROM anon;
```

Notes:
- The RESTRICTIVE policy is the primary defence — `IS NOT DISTINCT FROM` allows no-op updates (PATCH bodies that re-send the same value), only blocks actual changes.
- The column REVOKE is belt-and-braces and is what the scanner pattern-matches against.
- Existing `prevent_platform_role_change()` trigger stays as a third layer (and still catches direct SQL from psql via the `authenticator` role if anyone routes around PostgREST).
- Admin promotion path: must go through service_role (edge function with service-role key) or a new SECURITY DEFINER RPC. None exists today; the existing `admin-stats` flow only *reads* `platform_role`, so no app code breaks.

---

## Finding B — Tenant storage scoped only to org folder

### Current live policy on `storage.objects`
```sql
-- "Tenants can read their property documents"  (PERMISSIVE, authenticated)
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM tenant_portal_access tpa
    JOIN tenancy_agreements ta ON ta.id = tpa.tenancy_id
    JOIN properties_v2 p       ON p.id  = ta.property_id
    WHERE tpa.user_id = auth.uid()
      AND tpa.revoked_at IS NULL
      AND tpa.can_view_documents = true
      AND (storage.foldername(objects.name))[1] = (p.org_id)::text   -- <-- only checks org_id
  )
)
```
Storage convention is `${orgId}/...` (verified in `useBulkDocumentUpload`, `useBulkDocScanner`, `useReportGeneration`, `WelcomeOverlay`) — there is **no `property_id` segment in the path**, so we can't tighten via `foldername[2]`. The correct anchor is the `public.documents` row, which carries `tenancy_id`, `property_id`, and `visible_to_tenants`.

### Fix — replace the policy with a documents-row join
```sql
DROP POLICY IF EXISTS "Tenants can read their property documents" ON storage.objects;
CREATE POLICY "Tenants can read their tenancy documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1
      FROM public.documents d
      JOIN public.tenant_portal_access tpa
        ON tpa.tenancy_id = d.tenancy_id
      WHERE tpa.user_id = auth.uid()
        AND tpa.revoked_at IS NULL
        AND tpa.can_view_documents = true
        AND COALESCE(d.visible_to_tenants, false) = true
        AND d.deleted_at IS NULL
        AND d.file_url LIKE '%' || storage.objects.name
    )
  );
```
- Anchors access to a `documents` row that is **explicitly tied to the tenant's tenancy_id**, is marked `visible_to_tenants`, and is not soft-deleted.
- `file_url LIKE '%' || name` handles the three observed `file_url` shapes (public URL, signed URL, bare path).
- Org-member policies on the bucket are untouched — staff still see everything.

### App-surface impact
Tenant portal document reads must come from `public.documents` rows that have `tenancy_id` set and `visible_to_tenants = true`. That's already how `tenant_portal_access` is modelled (per memory `tenant-portal-architecture`). No frontend change required; org-staff uploads that don't tag a `tenancy_id` simply won't be visible to tenants — which is the desired behaviour.

---

## Migration shape
Single idempotent migration:
- `DROP POLICY IF EXISTS` + `CREATE POLICY` (both)
- `REVOKE UPDATE (col) ... FROM role` is naturally idempotent
- No data writes

## Out of scope
The 7 warn-level findings (origin-header phishing, P&L / rent-receipt XSS, FreeAgent OAuth nonce, rate_limits service-role check, subscriptions realtime, SECURITY DEFINER lint sweep, leaked-password) — user asked only about the two Errors.

## Verify chain after apply
`bun run lint` · `bun run typecheck` · `bun run build` · re-run security scan to confirm both Errors clear.
