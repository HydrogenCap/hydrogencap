
# #48 — Drop `public.loans` (ship today, 2026-05-08)

## Go/no-go evidence summary

| Check | Result |
|---|---|
| `v1_freeze_guard` trigger installed & enabled on `public.loans` | ✅ `pg_trigger.tgenabled = 'O'` |
| Trigger function emits canonical message (post-#54c) | ✅ `RAISE EXCEPTION 'V1 table % is frozen — write to % instead'` with `ERRCODE='check_violation'` |
| Client-side guard (`throwV1Frozen('loans', …)`) wired into all V1 loan mutation hooks (#45) | ✅ |
| `src/__tests__/loans-frozen.test.ts` asserts insert/update/delete throw the canonical message | ✅ |
| Postgres-log soak count since 2026-05-04 | ⚠️ Inconclusive — analytics retains only ~minutes of `postgres_logs`; cannot evidence the 4-day window. Decision: accept client+CI evidence in lieu of server soak. |

**Recommendation accepted:** ship #48 today.

## Implementation steps

### 1. Pre-flight read-only checks (one psql round-trip; abort if any fail)

```sql
-- a) Trigger still active right before we drop
SELECT 1 FROM pg_trigger
WHERE tgname='v1_freeze_guard'
  AND tgrelid='public.loans'::regclass
  AND tgenabled='O';

-- b) No FKs from any other table point at public.loans
SELECT conname, conrelid::regclass
FROM pg_constraint
WHERE confrelid='public.loans'::regclass AND contype='f';

-- c) No views, RLS policies, or functions still reference it
SELECT n.nspname||'.'||c.relname AS view
FROM pg_rewrite r JOIN pg_class c ON c.oid=r.ev_class
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE r.ev_action::text LIKE '%public.loans%' AND c.relkind='v';

-- d) Row count snapshot for the audit doc
SELECT count(*) AS frozen_row_count FROM public.loans;
```

If (a) returns 0 row → STOP, re-install trigger first.
If (b) or (c) return rows → STOP, ask before proceeding (need to drop/repoint dependents).

### 2. Migration `supabase/migrations/<auto>-drop-v1-loans.sql`

Single transaction:

```sql
BEGIN;

-- Defensive: drop trigger first so DROP TABLE doesn't fight it
DROP TRIGGER IF EXISTS v1_freeze_guard ON public.loans;

-- Drop the table. CASCADE only if pre-flight (b)/(c) returned empty;
-- otherwise the bare DROP will fail loudly, which is what we want.
DROP TABLE public.loans;

COMMIT;
```

No `CASCADE`. We want the migration to abort if anything still depends on it — that's a signal we missed a reference, not something to silently bulldoze.

### 3. Client-side cleanup (same PR)

- Remove the `'loans'` arm from the union in `src/lib/v1Frozen.ts` (`v1Table` param + `v2Map`). The hooks calling `throwV1Frozen('loans', …)` should already be deleted in #45's wake — verify with `rg "throwV1Frozen\(['\"]loans"` and delete any stragglers.
- Update `src/__tests__/loans-frozen.test.ts` → either delete the file (preferred — the table no longer exists, so the DB-mirror rationale is moot) or repoint it to a still-frozen table for regression coverage. Recommend **delete**, since `tenancies-frozen.test.ts` already covers the pattern.
- `grep` sweep for any lingering `from('loans')` / `.from("loans")` Supabase calls and any `public.loans` references in edge functions; expect zero hits (V1 read-only freeze + #45 should have cleared them) but verify.

### 4. Post-flight verification

```sql
SELECT to_regclass('public.loans');  -- expect NULL
```

- Run `npm run lint`, `tsc --noEmit`, `vitest run` — all green.
- `node scripts/check-edge-functions.mjs` — confirm no edge fn references `public.loans`.

### 5. Docs

Append a `## #48 — public.loans dropped 2026-05-08` section to `docs/release/loans-reconciliation-plan-2026-05-02.md` recording:
- Frozen row count from pre-flight (d)
- Soak evidence rationale (client guard + CI test + zero hits in remaining minutes of `postgres_logs`; full server-side soak waived due to log retention)
- Migration filename + commit

## Risks & mitigations

- **Hidden FK / view reference** → bare `DROP TABLE` (no CASCADE) will fail the migration loudly; rollback via `BEGIN/COMMIT`.
- **Late-arriving writer we missed** → impossible at the DB layer post-drop (table gone); any caller will get a `relation "loans" does not exist` error caught by Sentry/edge-fn logger immediately.
- **Need to revert** → the table is empty of business data per the V2 cutover; restoration would be schema-only from migration history.

## STOP-and-ask conditions during build

- Pre-flight check (b) or (c) returns any row.
- `DROP TABLE` fails with a dependency error.
- Any `from('loans')` hit in `src/` or `supabase/functions/` outside `v1Frozen.ts` / the test file being deleted.
