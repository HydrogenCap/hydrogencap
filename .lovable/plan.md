# Compliance §0b Ship D — V1 `bulk-epc-enrich` dead/live audit

## Step 1 — Static grep (`src/` + `supabase/functions/`)

Exact-match search for `'bulk-epc-enrich'` / `"bulk-epc-enrich"` (V1, distinct from V2) returned **zero invocation callers**. All hits referencing the bare V1 name are non-invocation:

| File:Line | Context | Caller? |
|---|---|---|
| `supabase/functions/bulk-epc-enrich/index.ts:111` | `serve(withInvocationLog("bulk-epc-enrich", …))` — the fn's own handler registration | No (self) |
| `scripts/check-no-v1-table-refs.mjs:48` | Path entry in V1 write-guard allowlist | No (lint config) |
| `docs/release/rls-audit-2026-04-26.md:237` | Audit table row | No (docs) |
| `docs/release/edge-logging-audit-2026-04-29.md:40` | Logging inventory row | No (docs) |
| `docs/release/compliance-cutover-2026-05-08.md:60` | Prior cutover notes | No (docs) |

Every `supabase.functions.invoke(...)` and `useBulkEpcEnrich…` reference in `src/` points to **`bulk-epc-enrich-v2`** (`src/hooks/useBulkEpcEnrichV2.ts:16` + its tests). No V1 hook exists. No UI button is wired to V1.

## Step 2 — pg_cron

```sql
SELECT jobid, schedule, command, active FROM cron.job WHERE command ILIKE '%bulk-epc-enrich%';
```

Result: **0 rows**. No scheduled job targets V1 (and none targets V2 either — EPC enrichment is user-triggered, not cron-driven).

## Step 3 — Deployment manifest

`supabase/config.toml` declares only `[functions.migrate-stranded-photos]` for non-default config. `bulk-epc-enrich` is deployed (default settings) by virtue of the directory existing, but has no explicit manifest entry pinning it as required. Both V1 and V2 directories live side-by-side; deletion of the V1 directory will deregister it on next deploy.

## Step 4 — Invocation logs

`supabase--edge_function_logs` for `bulk-epc-enrich` returned **"No logs found"**. No invocations within the retention window (covers ≥ recent days; effectively no live traffic).

## Step 5 — Verdict: **(a) DEAD**

- 0 callers in `src/` or `supabase/functions/`
- 0 cron jobs
- 0 recent invocations
- All EPC-enrichment work in the app flows through `useBulkEpcEnrichV2` → `bulk-epc-enrich-v2`, which already operates on `properties_v2` and writes `compliance_documents_v2`.

## Step 6 — Rationale paragraph for Ship D

> V1 `bulk-epc-enrich` is confirmed dead code. A static grep across `src/` and `supabase/functions/` finds zero callers — the only V1 references are the function's own `serve(...)` registration, the V1 write-guard allowlist entry in `scripts/check-no-v1-table-refs.mjs`, and three release-doc audit rows. The single hook that drives EPC enrichment from the UI (`useBulkEpcEnrichV2`) targets `bulk-epc-enrich-v2` exclusively. `cron.job` has no entries matching `bulk-epc-enrich`, and Supabase edge-function logs return no invocations for the V1 name. The V2 sibling already operates on `properties_v2` + writes `compliance_documents_v2`, fully replacing V1's scope. Ship D should delete the `supabase/functions/bulk-epc-enrich/` directory, call `supabase--delete_edge_functions(['bulk-epc-enrich'])` to deregister the deployed function, and remove the V1 allowlist entry at `scripts/check-no-v1-table-refs.mjs:48`. No migration step or stub-and-observe phase is needed — option (c)'s safety stub is unnecessary given both static grep and runtime logs agree on dead status.

## Ship D recommended actions (preview only — no changes this turn)

1. `rm -r supabase/functions/bulk-epc-enrich/`
2. `supabase--delete_edge_functions(['bulk-epc-enrich'])`
3. Remove line 48 of `scripts/check-no-v1-table-refs.mjs` (the `'supabase/functions/bulk-epc-enrich/index.ts'` allowlist entry)
4. Append release note to `docs/release/compliance-cutover-2026-05-08.md` under a `## Ship D — V1 bulk-epc-enrich removal` section
5. Optional: tidy the now-stale row in `docs/release/edge-logging-audit-2026-04-29.md:40` and `docs/release/rls-audit-2026-04-26.md:237` (or leave as historical record — David's call)

No STOP-and-ask triggered: grep surfaced no unexpected UI caller wired to V1.
