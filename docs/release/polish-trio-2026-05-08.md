# Polish trio — 2026-05-08

## Polish trio shipped 2026-05-08

Three small isolated items bundled as one PR.

### Item A — ESLint grep guard for `no-explicit-any` disables in `src/`
CI-time check that fails if any `eslint-disable .* @typescript-eslint/no-explicit-any` line appears in `src/` outside an allowlist of two boilerplate files (`src/components/ui/chart.tsx` shadcn-generated, `src/integrations/supabase/client.ts` preconfigured client). Wired into `package.json` as `check:no-any-disables` and inserted into the `verify` chain immediately after `lint`. Confirmed passing on current state.

Files:
- `scripts/check-no-explicit-any-disables.mjs` (new)
- `package.json` (added `check:no-any-disables` script + `verify` chain)

### Item B — Admin helper unit tests for `_shared/admin-client.ts`
Deno tests covering the env-missing failure path (both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` absent cases), the happy path returning a client with a `.from()` method, and a compile-time structural-type check for `AdminSupabaseLike`. Mirrors the conventions of `_shared/rateLimit.test.ts`. The happy-path test opts out of Deno's resource-leak sanitizer because the underlying `supabase-js` client schedules auth-refresh timers we don't own. Run via `deno test supabase/functions/_shared/admin-client.test.ts --allow-env --allow-net` — 4 passed / 0 failed.

Files:
- `supabase/functions/_shared/admin-client.test.ts` (new)

### Item C — CSV loan importer skip warning — **NOT SHIPPED (STOP-and-ask)**
No dedicated CSV loan importer exists in the codebase. The unified property CSV import (`src/hooks/useBatchImport.ts`) explicitly froze loan-column writes per Prompt #45 and silently no-ops any loan columns; loan facilities are created exclusively via the V2 wizard (`useCreateLoanFacility`). Implementing skip-warning UX here would mean either (a) re-introducing a write path that's deliberately frozen, or (b) inventing a brand-new loan-facility CSV importer surface — both wider than the polish trio scope. Surfacing for a follow-up decision rather than guessing.

Files: none.

### Verify
- `node scripts/check-no-explicit-any-disables.mjs` → ✓ no offenders.
- `node scripts/check-edge-functions.mjs` → 71 entry files OK.
- `deno test supabase/functions/_shared/admin-client.test.ts` → 4 passed.
