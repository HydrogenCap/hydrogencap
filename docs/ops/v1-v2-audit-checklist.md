# V1 → V2 Audit Checklist

> Operational playbook for auditing a §0b V1 table before authoring its
> "Ship X" cutover migration. Distilled from the audits run during the
> 2026-04-30 → 2026-05-12 drift-closure sprint.
>
> Companion docs:
> - [`v1-v2-fk-drift-2026-04-30.md`](../release/v1-v2-fk-drift-2026-04-30.md) — running ship log
> - [`ci-retry-policy.md`](./ci-retry-policy.md) — verify-chain retry semantics

---

## 1. Pre-audit ground-truth queries

Run these against the live DB **before** opening any source files. The DB is
the source of truth — `types.ts` lags real schema by one regen cycle and
migration files lie about the current state once later migrations have
mutated objects.

```sql
-- 1a. All triggers on a target table (freeze-trigger state, audit-log wiring)
SELECT tgname, tgtype, pg_get_triggerdef(oid) AS def
FROM pg_trigger
WHERE tgrelid = 'public.<table>'::regclass AND NOT tgisinternal
ORDER BY tgname;

-- 1b. Functions (and their bodies) that name the table
SELECT n.nspname, p.proname,
       pg_get_functiondef(p.oid) ILIKE '%<table>%' AS body_match
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ~ ('\m' || '<table>' || '\M');

-- 1c. Views / matviews referencing the table
SELECT c.relname, c.relkind, pg_get_viewdef(c.oid)
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('v','m')
  AND pg_get_viewdef(c.oid) ~ ('\m' || '<table>' || '\M');

-- 1d. Inbound and outbound foreign keys
SELECT conname, conrelid::regclass AS from_tbl, confrelid::regclass AS to_tbl,
       pg_get_constraintdef(oid)
FROM pg_constraint
WHERE contype = 'f'
  AND ('public.<table>'::regclass IN (conrelid, confrelid));

-- 1e. RLS policies (current, not what migrations claim)
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM pg_policy WHERE polrelid = 'public.<table>'::regclass;

-- 1f. All objects that depend on the table (catches indirect callers)
SELECT classid::regclass, objid::regclass, deptype
FROM pg_depend
WHERE refobjid = 'public.<table>'::regclass;

-- 1g. Row count (don't trust frontend-reported counts)
SELECT count(*) FROM public.<table>;
```

Persist the raw output of 1a–1f into the audit doc verbatim — it is the
ground truth the rest of the audit references.

---

## 2. Per-§0b-table audit template

Used during the `compliance_items` audit. Twelve sections, in order:

1. **Schema parity** — column-by-column diff between V1 and V2 target
   (`information_schema.columns`). Flag missing columns, type mismatches,
   nullability deltas. Note any V2-only columns that need a backfill source.
2. **Row counts** — V1 vs V2 (and any double-write target). Mismatches gate
   the cutover; equal counts gate Ship X authoring.
3. **V1 writers** — every `INSERT`/`UPDATE`/`DELETE` site against V1 in
   `src/`, `supabase/functions/`, and `supabase/migrations/`. Group by:
   active code path, allowlisted legacy bridge, or RLS-only migration.
4. **V1 readers** — every `SELECT` / `.from('<table>')` site. Same grouping.
5. **Double-writers** — code paths writing to **both** V1 and V2. These
   become the cutover surface area; each one needs a "drop V1 leg" PR slot
   in the ship plan.
6. **Foreign keys** — inbound (children pointing at V1) and outbound (V1
   pointing at parents). Inbound FKs are the hard cutover constraint:
   children must migrate to V2 parent before V1 can be dropped.
7. **RLS** — current policies on V1, current policies on V2, and whether
   V2 has parity coverage. Missing V2 policies block Ship X.
8. **Background functions** — pg_cron jobs, edge fns, triggers that read
   or write V1. Each needs a redirect-to-V2 PR slot.
9. **Freeze-trigger state** — is V1 already frozen? Run
   `npm run check:freeze-triggers` (or `:db` mode against live). If not
   frozen, freeze in Ship X-1.
10. **Audit-log coverage** — does V2 have a row in the generic
    audit-trigger registry? If not, add in Ship X.
11. **Recommended ship order** — explicit list: "Ship A: redirect readers.
    Ship B: redirect writers. Ship C: freeze V1. Ship D: drop V1." Each
    ship must be independently revertable.
12. **Open product questions** — anything that needs human decision before
    the ship is safe (e.g. "do we preserve V1 historical rows post-drop?").

Treat skipped sections as red flags, not optional.

---

## 3. STOP-and-ask discipline — 7 lessons

Captured from cases where shipping ahead of clarification cost a revert
or a scope balloon.

1. **Audit-correction discipline** — when the user's stated scope (e.g. "4
   fns + 1 view") doesn't match the live audit (e.g. "3 fns + 1 view"),
   STOP. Surface the delta with the actual `pg_proc`/`pg_class` rows. Do
   not silently rescope. Example: the Partial-#61 won't-fix close — user
   asserted 4 fns, audit found 3, two of which were in the user's own
   KEEP list.
2. **`AddShareClassDialog` list+realtime+write coupling** — components
   that combine a list query, a realtime subscription, and a write mutation
   on the same table will desync if any one leg is migrated to a renamed
   table without the other two. Always migrate the trio atomically or
   STOP and ask which leg leads.
3. **`_v2` suffix isn't always Partial-#61 legacy** — fns/views named
   `migrate_*_to_v2`, `seed_*_v2`, `recalculate_ltv_v2` carry `_v2` as
   a semantic implementation marker (they implement V2 behaviour). Only
   suffixes on artifacts whose canonical sibling has been **renamed away**
   are cosmetic-#61 candidates. STOP if unsure — query bodies and classify.
4. **`compliance_items` breaks the 1:1 template** — the §0b "one V1 table
   maps to one V2 table" assumption fails for compliance_items, which
   splits into `compliance_requirements` + `compliance_documents`. STOP
   any audit that assumes 1:1 and switch to the split-table template.
5. **STOP-and-ask cascades on red verify chain** — when `npm run verify`
   is red, every queued ship inherits the red. Do not start a new ship
   on a red chain; STOP and ask whether to fix the red first or revert
   the offending ship.
6. **Lovable's queue is single-slot** — the agent can only hold one ship
   in flight per response. If a request bundles a ship + a follow-up
   audit + a drift-doc append + a polish, STOP and ask which slot.
   Prefer: "ship the migration; queue audit and polish as follow-ups."
7. **Budget guard auto-aborts long-scope ships** — sweeps that touch >10
   files or >5 migrations hit the response-budget guard. STOP at the audit
   step and surface caller counts (e.g. `compliance_matrix_v2` = 18
   sites) before authoring the migration. Let the user decide
   override-vs-defer rather than burning the budget mid-rewrite.

---

## 4. When to use which audit script

| Need | Script | Mode |
|---|---|---|
| Static scan for V1 table names in `src/` + `supabase/` | `scripts/check-no-v1-table-refs.mjs` | (default) — exits non-zero on any §0a-fully-dropped or non-allowlisted §0b ref |
| §0b progress visualization (where do legitimate refs live?) | `scripts/check-no-v1-table-refs.mjs --report` | Emits `reports/v1-refs/<UTC-date>.{json,md}`, always exits 0 |
| Confirm freeze-triggers parity from migration files | `scripts/check-freeze-trigger-coverage.mjs` | (default) — static parser, used in verify chain |
| Same, but query live `pg_trigger` (drift detection) | `scripts/check-freeze-trigger-coverage.mjs --mode=db` | Opt-in fallback (`check:freeze-triggers:db`), needs `SUPABASE_DB_URL` or `SUPABASE_URL`+`SUPABASE_SERVICE_ROLE_KEY` |
| Verify edge fn deno.land imports resolve | `scripts/check-edge-functions.mjs` | Wrapped via `run-with-retry.mjs`; see `ci-retry-policy.md` |
| Smoke-test the retry wrapper itself | `scripts/check-retry-wrapper-smoke.mjs` | Runs in verify chain; uses fixture in `scripts/__fixtures__/` |
| `eslint-disable @typescript-eslint/no-explicit-any` audit | `scripts/check-no-explicit-any-disables.mjs` | Verify chain; allowlisted via inline marker |
| Live ground-truth queries (Section 1 above) | `psql` or `supabase--read_query` | Manual — these don't have a script wrapper, intentionally |

Rule: if a question is answerable from `pg_*` catalogs, query directly. If
it's answerable from the repo (refactor-safety, dead-code), use a script.
Don't write scripts that re-query the catalog when `psql` is one call away.

---

## 5. Verify chain expectations

Cross-reference: see [`ci-retry-policy.md`](./ci-retry-policy.md) for retry
semantics on the edge-fn check (the only step wrapped by `run-with-retry.mjs`).

`npm run verify` runs, in order:

1. `lint` — fails fast (no retry)
2. `check:no-any-disables` — fails fast
3. `check:no-v1-refs` — fails fast (this guard hardened in #104)
4. `check:freeze-triggers` — fails fast (static parser; DB-mode is opt-in)
5. `vitest` — fails fast
6. `check:edge` — **wrapped via `run-with-retry.mjs`**, transient failures
   retried per the matcher set in `ci-retry-policy.md`
7. `check:retry-wrapper` — smoke test for #6's wrapper

Expectations during an audit:

- **Audit doc edits alone** (this file, drift doc, release notes) should
  leave verify GREEN with zero waiting. If any step turns red after a
  pure-docs change, the change isn't pure-docs — STOP and find the side
  effect (most often: a fenced code block accidentally importing a real
  file path that fixture-walks pick up).
- **Migration-bearing audits** must run verify locally before opening
  the next ship. A red verify after a migration cascades per Lesson 5.
- **DB-mode freeze-trigger check** is *not* in the verify chain by design
  — it requires live DB credentials and is meant for drift detection
  during audits, not CI gating.

When in doubt: run verify, capture the output, paste it into the audit
doc. The chain itself is the audit's last section.
