# #54b Precursor Scope — Tenant Portal Access V2 Cutover

## TL;DR — Go/No-Go

**GO. Cheap path.** A single Build prompt covers the precursor. No DDL on `tenant_portal_access`, no backfill, no ID remap. The V1 storage policy can be replaced with a V2 equivalent in one migration; `generate_tenancy_compliance_items(tenancies)` can be dropped outright; then #54b's `DROP TABLE public.tenancies` proceeds unchanged.

## Step 1 — Current state

### 1a. Storage RLS policy `"Tenants can read their property documents"`

```sql
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1
    FROM tenant_portal_access tpa
    JOIN tenancies t ON tpa.tenancy_id = t.id
    JOIN properties p ON t.property_id = p.id
    WHERE tpa.user_id = auth.uid()
      AND tpa.revoked_at IS NULL
      AND (storage.foldername(objects.name))[1] = p.org_id::text
  )
)
-- WITH CHECK: NULL (read-only policy)
```

**Semantics:** authenticated user with a non-revoked `tenant_portal_access` row → can read any object in `documents` bucket whose first path segment is the org_id of the property attached to their tenancy. (Org-scoped, not property-scoped — coarse by design.)

### 1b. `generate_tenancy_compliance_items(tenancies)` — disposition

- Body inserts seeded `tenancy_compliance_items` rows on tenancy creation (gas cert, EPC, deposit protection, right-to-rent, etc.).
- Called by exactly one site: trigger function `public.trigger_generate_tenancy_compliance()`, attached as `generate_tenancy_compliance_after_insert` on `public.tenancies`.
- That trigger drops with the table. The function has **no other callers** (verified: zero `pg_proc` defs reference it apart from the trigger fn, zero `src/` and `supabase/functions/` matches in #71's audit).
- `#54a` write-freeze means no new INSERTs reach it anyway.
- **Disposition: DROP outright.** No V2 rewrite. V2 compliance seeding is handled elsewhere (`v2-automation-triggers` memory — `tenancy_agreements` has its own seeding path).

### 1c. `tenant_portal_access` schema

Columns: `id`, `org_id`, `tenant_id`, `tenancy_id`, `user_id`, `invite_id`, `granted_at`, `revoked_at`, `can_view_rent`, `can_view_documents`, `can_submit_maintenance`.

Constraints/indexes: PK on `id`, unique `(user_id, tenancy_id)`. **No FK from `tenancy_id` to `public.tenancies`** — the column is a bare `uuid`, so dropping `public.tenancies` does not cascade-affect this table. Good.

### 1d. Other deps on `public.tenancies` via `pg_depend`

Cross-checked all non-trivial dep classes. Findings:

- 2 RLS policies on `public.tenancies` itself (`Org members manage tenancies`, `Tenants view own tenancies`) — drop with table.
- 1 storage policy (the one above) — the dep we're handling.
- The composite row type (`pg_type` entry) — drops with table.
- 4 other triggers on `public.tenancies` (`trigger_auto_rent_schedule`, `trigger_update_room_on_tenancy`, `update_tenancies_updated_at`, `v1_freeze_guard`) — all drop with table; their underlying functions don't take `tenancies` as a row-type argument so they survive harmlessly.

**No third missed dep.** Pre-flight clean once policy + function are dealt with.

## Step 2 — `tenant_portal_access` ↔ `tenancy_agreements` mapping

```
total tenant_portal_access rows .................. 0
active (revoked_at IS NULL) ...................... 0
tenancy_id matches tenancy_agreements.id ......... 0
tenancy_id matches public.tenancies only (V1) .... 0
orphaned (matches neither) ....................... 0
```

The table is empty in production. (Tenant portal not yet onboarded with real users.)

**Implication:** there is nothing to backfill, nothing to remap, no risk of breaking live tenant sessions. The `tenancy_id` column can stay bare-uuid for now; future inserts from invite acceptance will write `tenancy_agreements.id` directly.

## Step 3 — Recommendation: **Cheap path**

Single migration:
1. `DROP POLICY "Tenants can read their property documents" ON storage.objects;`
2. `CREATE POLICY` (V2 equivalent — see Step 4).
3. `DROP FUNCTION public.generate_tenancy_compliance_items(public.tenancies);`

Then #54b lands as drafted (`DROP TRIGGER v1_freeze_guard` + `DROP TABLE public.tenancies`) — either same PR or follow-up.

No code changes required: `useTenantPortalSession.ts` already reads `tenant_portal_access` directly with no join through V1. Tenant portal pages still need their own V2 cutover (per `.lovable/AF2_Tenant_Portal_V2.md`) but that's orthogonal to #54b — it can ship before or after.

## Step 4 — Draft V2 storage policy

```sql
CREATE POLICY "Tenants can read their property documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.tenant_portal_access tpa
    JOIN public.tenancy_agreements ta ON ta.id = tpa.tenancy_id
    JOIN public.properties_v2 p ON p.id = ta.property_id
    WHERE tpa.user_id = auth.uid()
      AND tpa.revoked_at IS NULL
      AND tpa.can_view_documents = true
      AND (storage.foldername(objects.name))[1] = p.org_id::text
  )
);
```

Differences vs V1 — all intentional improvements:
- Joins V2 graph (`tenancy_agreements` → `properties_v2`).
- Adds `can_view_documents = true` gate (V1 ignored this column — bug).
- `TO authenticated` clause replaces `auth.role() = 'authenticated'` predicate (idiomatic).
- Same org-scoped folder check, same read-only semantics, same coarseness — no behavioural regression for any future tenant session.

Because `tenant_portal_access` is empty, the rewrite is observationally a no-op at cutover time.

## Step 5 — `generate_tenancy_compliance_items` disposition: **DROP**

Confirmed in Step 1b. Single line: `DROP FUNCTION public.generate_tenancy_compliance_items(public.tenancies);`. No rewrite, no V2 equivalent needed (V2 has its own seeding via `v2-automation-triggers`).

## Step 6 — Recommended Build prompt outline (for the follow-up)

> **Build mode. Goal: ship #54b precursor — rewrite tenant-portal storage policy onto V2, drop the orphaned V1 compliance-seed function. Single migration, no backfill (tenant_portal_access is empty — verified 2026-05-08). Steps:**
>
> 1. **Migration** with three statements, in order:
>    - `DROP POLICY "Tenants can read their property documents" ON storage.objects;`
>    - `CREATE POLICY` joining `tenant_portal_access → tenancy_agreements → properties_v2`, gated on `can_view_documents = true`, org-scoped folder check (see drafted SQL in plan).
>    - `DROP FUNCTION public.generate_tenancy_compliance_items(public.tenancies);`
> 2. **Verify** post-migration: `to_regprocedure('public.generate_tenancy_compliance_items(public.tenancies)')` is NULL; new policy exists on `storage.objects`; `pg_depend` on `public.tenancies` shows zero non-trivial entries (only intra-table triggers + 2 own-table policies + composite row type left).
> 3. **No code changes** — `useTenantPortalSession.ts` already V2-compatible (queries `tenant_portal_access` directly, no V1 join).
> 4. **Document** in `docs/release/v2-design-loans-income-costs-tenancies-2026-04-30.md` under #54b precursor — state cheap-path rationale, empty-table evidence, semantic improvements (added `can_view_documents` gate).
> 5. **Then unblock #54b** — schedule the `DROP TABLE public.tenancies` migration as a follow-up PR (or same PR, two migration files, separate commits) once this lands.
>
> **STOP-and-ask** if `tenant_portal_access` row count is non-zero at Build time (changes the calculus — needs sanity check that any live `tenancy_id`s resolve in `tenancy_agreements`).

## Risks / edge cases

- **`tenant_portal_access` could gain rows between now and Build.** Mitigation: re-run the row-count check at Build time (cheap). If a row appears with a `tenancy_id` not in `tenancy_agreements`, it's a bug in invite acceptance — fix the writer, don't backfill.
- **Tenant portal pages still query V1 tables** (per AF2 plan) — out of scope for this precursor and for #54b; the storage RLS rewrite doesn't depend on the page-level cutover.
- **No data loss risk** — `tenancy_compliance_items` rows already inserted historically by the function are untouched (the rows persist; only the seeding function is removed).
