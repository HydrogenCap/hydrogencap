## Goal
Block self-elevation to `super_admin` via `public.profiles`. Confirmed live: the privilege column is **`platform_role`** (text, NOT NULL, values seen: `'user'`, `'super_admin'`). A secondary `role` column also exists (nullable text) but is **not** the platform-admin gate — `admin-stats` checks `platform_role`. We will guard both columns to be safe.

## Live state

**Columns of interest on `public.profiles`:**
- `platform_role text NOT NULL` — the actual super-admin flag (checked by `admin-stats` edge function).
- `role text NULL` — legacy/secondary role column, also client-writable today.

**Current UPDATE policy (live):**
```sql
-- "Users can update own profile"
USING      (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```
No column restriction → a user can `UPDATE profiles SET platform_role='super_admin' WHERE user_id=auth.uid()` and own the platform.

**Existing triggers on `profiles`:** only `set_profiles_updated_at` (timestamp helper). No guard trigger exists.

**Existing admin helpers:** none in `public` matching `is_admin` / `platform` / `super_admin` — the edge function reads `platform_role` directly. So we'll inline the check.

## Proposed fix — one idempotent migration

```sql
CREATE OR REPLACE FUNCTION public.prevent_platform_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_role text;
BEGIN
  -- Service role (edge functions, server-side admin code) is always allowed.
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Caller's current platform_role (NULL if unauthenticated).
  SELECT p.platform_role INTO caller_role
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  IF NEW.platform_role IS DISTINCT FROM OLD.platform_role
     AND COALESCE(caller_role, '') <> 'super_admin' THEN
    RAISE EXCEPTION 'platform_role can only be changed by a super_admin or service_role';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     AND COALESCE(caller_role, '') <> 'super_admin' THEN
    RAISE EXCEPTION 'role can only be changed by a super_admin or service_role';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_platform_role ON public.profiles;
CREATE TRIGGER guard_platform_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_platform_role_change();
```

### Why this shape
- `BEFORE UPDATE` trigger preserves the existing self-update policy (users can still change `full_name`, `marginal_tax_rate`, etc.).
- `IS DISTINCT FROM` only fires when the column actually changes — no-op updates pass through.
- `SECURITY DEFINER` + `SET search_path` so the `profiles` read inside the trigger isn't subject to caller RLS and can't be shadowed.
- `current_setting('role', true) = 'service_role'` lets edge functions (e.g. `admin-stats`) continue to modify roles when using the service-role key.
- Existing super_admins can still promote/demote others (so you don't lock yourself out).
- Idempotent: `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`.

## Is the column client-writable today?
**Yes.** The UPDATE policy `auth.uid() = user_id` covers the whole row with no column scope, and PostgREST honours column-level writes from the JSON body. Any signed-in user can today PATCH `/rest/v1/profiles?user_id=eq.<their-id>` with `{"platform_role":"super_admin"}` and succeed. The trigger closes that.

## Out of scope
The other findings still pending (P&L print XSS, FreeAgent OAuth nonce, document_share_links anon, escalation_rules null-org writes, realtime.messages, SECURITY DEFINER lint sweep, leaked-password protection). User asked only about the critical self-elevation issue.

## Verify chain after apply
`bun run lint`, `bun run typecheck`, `bun run build`, then re-run the security scan to confirm `platform_role_self_elevation` clears.
