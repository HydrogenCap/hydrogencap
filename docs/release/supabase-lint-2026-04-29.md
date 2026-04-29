# Supabase Linter Audit — 2026-04-29

Source: `supabase--linter` tool run, total **182 findings** (1 INFO + 181 WARN).

## Bucket summary

| # | Bucket | Lint code | Severity | Count | Disposition |
|---|--------|-----------|----------|-------|-------------|
| 1 | RLS Enabled, No Policy | `0008` | INFO | 1 | Case-by-case (review intent of empty-policy table) |
| 2 | Function Search Path Mutable | `0011` | WARN | 2 | **Safe mechanical fix — applied this pass** |
| 3 | RLS Policy Always True (write) | `0024` | WARN | 1 | Case-by-case (some are deliberate service-role ingest) |
| 4 | Public Bucket Allows Listing | `0025` | WARN | 1 | Case-by-case (storage policy review) |
| 5 | Public Can Execute SECURITY DEFINER | `0028` | WARN | 88 | Case-by-case (each function needs auth-flow review) |
| 6 | Signed-In Users Can Execute SECURITY DEFINER | `0029` | WARN | 88 | Case-by-case (mostly intentional, but needs per-fn audit) |
| 7 | Leaked Password Protection Disabled | auth | WARN | 1 | One-click in Auth dashboard (operator action) |
|   | **Total** |  |  | **182** |  |

Note buckets 5 and 6 share the same 88 underlying functions — every public `SECURITY DEFINER` function is double-counted (anon-callable AND authenticated-callable), which matches `SELECT count(*) FROM pg_proc WHERE prosecdef AND pronamespace='public'::regnamespace` = **88**.

---

## Bucket 1 — RLS Enabled, No Policy (1)

Representative:
- `public.maintenance_updates` — RLS on, zero policies → table is effectively empty to all non-service callers.

**Recommendation:** case-by-case. Either add an org-scoped policy (most likely intent) or drop the table if unused. Not safe to mass-fix.

## Bucket 2 — Function Search Path Mutable (2) ✅ FIXED THIS PASS

Both flagged functions live in `public`:
- `public.prevent_locked_snapshot_update()`
- `public.v1_freeze_guard()`

**Recommendation:** mechanical fix — `ALTER FUNCTION ... SET search_path = public, pg_temp`. Eliminates schema-injection risk without touching behaviour. Migration: `20260429010000_harden_function_search_path.sql`.

(All other `search_path`-mutable functions surfaced by `pg_proc` introspection live in `extensions`, `storage`, `realtime`, `net`, `cron`, `auth`, `vault`, `graphql_public` — Supabase-managed schemas we are not allowed to alter, and the linter correctly does not flag them.)

## Bucket 3 — RLS Policy Always True on write (1)

Representative:
- `public.demo_requests / "Anyone can submit demo requests" / INSERT WITH CHECK (true)` — likely intentional (public marketing form).

**Recommendation:** case-by-case. Confirm each "true" write policy is a deliberate public-ingest endpoint, otherwise tighten with `auth.uid() IS NOT NULL` or org membership check. Other candidates seen during audit: `scheduled_email_runs`, `notifications`, `audit_log` (these look like service-role inserts that could move to the `service_role` role explicitly).

## Bucket 4 — Public Bucket Allows Listing (1)

**Recommendation:** case-by-case. Identify the bucket, decide whether it should remain public-readable; if yes, restrict the SELECT policy from `bucket_id = 'X'` to `bucket_id = 'X' AND name = (storage.filename(name))` style or move to signed URLs (project pattern per memory `storage-access-control-v3`).

## Bucket 5 + 6 — SECURITY DEFINER functions executable by anon / authenticated (88 + 88)

Representative functions:
- `public.run_compliance_scan` (likely fine — internal cron)
- `public.audit_tenant_delete` (trigger function — should not be callable at all; consider revoking EXECUTE from `PUBLIC`)
- `public.migrate_rooms_to_v2` (one-off migration helper — should be revoked)
- `public.get_user_role` (intentional — used inside RLS policies)
- `public.refresh_compliance_statuses_v2` (likely intentional cron)

**Recommendation:** case-by-case. Each function falls into one of three buckets:
1. **Used inside RLS policies** (e.g. `get_user_role`, `has_role`, `user_has_org_access`) — must remain callable, keep as `SECURITY DEFINER`, accept the warning or document the suppression.
2. **Trigger-only functions** (`audit_*`, `prevent_*`) — `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`. Triggers fire as table owner regardless.
3. **One-off migration / admin helpers** (`migrate_*`, `backfill_*`) — same revoke, or drop if no longer needed.

Mass-revoke is **not** safe because category 1 functions break RLS if their EXECUTE grant is removed. A future pass should classify each of the 88 functions explicitly.

## Bucket 7 — Leaked Password Protection Disabled (1)

**Recommendation:** Operator action — Auth → Settings → toggle "Leaked password protection" (uses HaveIBeenPwned). No migration possible.

---

## What was applied this pass

Migration: `20260429010000_harden_function_search_path.sql`

```sql
ALTER FUNCTION public.prevent_locked_snapshot_update() SET search_path = public, pg_temp;
ALTER FUNCTION public.v1_freeze_guard() SET search_path = public, pg_temp;
```

Behaviour: identical. Both functions now resolve unqualified identifiers exclusively against `public` and `pg_temp`, eliminating the schema-shadowing attack surface called out by linter rule `0011`.

## Open follow-up buckets (require future case-by-case sessions)

1. Bucket 1 — `maintenance_updates` empty-policy decision (1 table)
2. Bucket 3 — audit `USING/CHECK (true)` write policies, tighten where unintended (1 policy + ~3-4 service-role inserts to migrate to `TO service_role`)
3. Bucket 4 — public storage bucket SELECT policy review (1 bucket)
4. Buckets 5 & 6 — classify all 88 `SECURITY DEFINER` functions into RLS-helper / trigger-only / admin-only, then `REVOKE EXECUTE` from categories 2 and 3 (~60 functions estimated)
5. Bucket 7 — enable Leaked Password Protection in Auth dashboard (operator)

## Post-migration linter expectation

| Bucket | Before | After |
|---|---|---|
| Function Search Path Mutable | 2 | 0 |
| All other buckets | 180 | 180 |
| **Total** | **182** | **180** |
