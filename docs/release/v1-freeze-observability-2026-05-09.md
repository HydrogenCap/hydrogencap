# V1 Freeze Observability — 2026-05-09

## v1_freeze_violations audit table shipped 2026-05-09

Closes #70's soak-unobservability lesson: Postgres log retention is too short
to observe a multi-day freeze-trigger soak, so we now capture every blocked
write attempt against a frozen V1 table in a queryable Postgres table. Each
remaining §0b cutover's E-step (freeze trigger + soak) can now be observed
server-side instead of relying on disappearing log lines.

### Schema

```sql
CREATE TABLE public.v1_freeze_violations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      text NOT NULL,
  query_fragment  text,                 -- left(current_query(), 1024)
  db_session_user text NOT NULL,        -- session_user; column renamed to
                                        -- avoid the `session_user` reserved
                                        -- keyword
  attempted_op    text NOT NULL CHECK (attempted_op IN ('insert','update','delete')),
  attempted_at    timestamptz NOT NULL DEFAULT now(),
  error_code      text                  -- '23514' (check_violation, the
                                        -- SQLSTATE the freeze RAISE emits)
);

CREATE INDEX idx_v1_freeze_violations_table_time
  ON public.v1_freeze_violations (table_name, attempted_at DESC);
```

RLS is enabled. The only policies are SELECT/INSERT for `service_role`. There
are no policies for `authenticated` or `anon`, so under RLS the table is
invisible and unwritable to the app, the API, and end users. The trigger
function writes via SECURITY DEFINER context, which bypasses RLS regardless.

### Trigger modification

The shared `public.v1_freeze_guard()` plpgsql function (defined once,
attached as a `BEFORE INSERT OR UPDATE OR DELETE` trigger across all V1
tables per #54a's pattern) now records the violation **before** raising,
inside a `BEGIN … EXCEPTION WHEN OTHERS THEN NULL` block. Audit-write
failure (RLS, disk full, anything) is intentionally swallowed so it can
never mask the freeze RAISE. The behavioural contract (block the write,
raise `check_violation`, point at the V2 target) is unchanged.

### Trigger installation status (as of 2026-05-09)

V1 tables that **currently have** the freeze guard:

| V1 table   | V2 target                  | Trigger present | Audit visible from now |
|------------|----------------------------|-----------------|------------------------|
| properties | properties_v2              | ✓               | ✓ |
| rooms      | rooms_v2                   | ✓               | ✓ |
| tenants    | tenants_v2                 | ✓               | ✓ |

V1 tables in the §0b set that **do not yet** have the freeze guard — they
will get it at their respective E-steps:

| V1 table             | V2 target                       | E-step |
|----------------------|---------------------------------|--------|
| compliance_items     | compliance_requirements_v2 / compliance_documents_v2 (split) | Compliance §0b Ship E |
| compliance_documents | compliance_documents_v2         | Compliance §0b Ship E |
| share_classes        | share_classes_v2                | Share-classes §0b Ship E |

Note: `loans`, `costs`, `tenancies`, `income` had freeze triggers at one
point but their V1 tables were dropped per Plan §0a, so no trigger remains
to instrument. The audit table is forward-looking from here.

### How to observe a soak window

```sql
-- Have any blocked attempts hit a given V1 table in the last 7 days?
SELECT count(*)
FROM   public.v1_freeze_violations
WHERE  table_name = 'properties'
AND    attempted_at > now() - interval '7 days';

-- Which sessions / queries are still trying?
SELECT attempted_at,
       attempted_op,
       db_session_user,
       left(query_fragment, 200) AS query_preview
FROM   public.v1_freeze_violations
WHERE  table_name = 'tenants'
AND    attempted_at > now() - interval '7 days'
ORDER  BY attempted_at DESC
LIMIT  50;

-- Per-table soak summary across the whole §0b set.
SELECT table_name,
       attempted_op,
       count(*)               AS hits,
       min(attempted_at)      AS first_hit,
       max(attempted_at)      AS last_hit
FROM   public.v1_freeze_violations
WHERE  attempted_at > now() - interval '14 days'
GROUP  BY table_name, attempted_op
ORDER  BY table_name, attempted_op;
```

A clean soak = `count(*) = 0` over the soak window. Any non-zero result
identifies the offending session / query for follow-up before Ship F drops
the V1 table.

### Forward pointer

Each §0b cutover's E-step (compliance items + documents, properties, rooms,
tenants, share_classes) should:

1. Confirm the freeze trigger is installed on the V1 table (add it if not).
2. Cite this table in the soak observation plan: query it weekly during the
   soak window, escalate any non-zero count, only proceed to Ship F when the
   soak has been clean for the agreed duration.

### Verification

- Migration applied successfully.
- Function shape unchanged for callers (same RAISE, same ERRCODE
  `check_violation` / SQLSTATE 23514).
- Linter results from the migration are 119 pre-existing project-wide
  warnings; none introduced by this change. The function was already
  SECURITY DEFINER before this migration, and `service_role`-only RLS with
  `USING (true)` is the standard shape for backend-only audit surfaces.
