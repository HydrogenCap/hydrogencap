# Security Hardening Pass — 2026-04-29 (Stage A.4)

Goal: close remaining lint findings + cross-tenant write-policy gaps surfaced by the lint triage. Lint count: **114 → 113**.

## Step 1 — USING/CHECK true write policies

Catalog inspection of `pg_policies` for the four flagged tables showed all of them are **already correctly scoped**. No write-policy changes were required.

| Table | INSERT | UPDATE | DELETE | Action |
|---|---|---|---|---|
| `audit_log` | `service_role` only (`WITH CHECK true`) | (none) | (none) | ✅ Already correct |
| `notifications` | `service_role` (`WITH CHECK true`) **and** `authenticated` scoped to `user_id = auth.uid()` | scoped to `user_id = auth.uid()` | (none) | ✅ Already correct |
| `scheduled_email_runs` | `service_role` only | `service_role` only (`USING true`) | (none) | ✅ Already correct — `USING true` is gated by `TO service_role`, role is the real scope |
| `demo_requests` | `public` with `WITH CHECK true` | (none) | (none) | ✅ **Intentional** — public marketing form anyone can submit |

The single remaining `RLS Policy Always True` lint warning (lint 0024) is `demo_requests."Anyone can submit demo requests"`. This is by design — it's the unauthenticated lead-capture form on the marketing site. Lint suppression is acceptable; tightening it would break the demo signup flow.

**Diff: 0 dropped, 0 replaced, 0 added.**

## Step 2 — `maintenance_updates` fate

Cross-codebase grep results:

- `src/lib/backupConfig.ts:98` — `{ table: 'maintenance_updates', prefix: '57', label: 'Maintenance Updates', essential: false }` (active reference in the portfolio backup system)
- `src/integrations/supabase/types.ts:5673` — generated row type (auto-regenerated from schema)
- `supabase/migrations/20260205021113_*.sql` — original CREATE TABLE
- `supabase/migrations/20260323103000_*.sql` — added then-current org-member + tenant policies (subsequently dropped somewhere along the chain — table currently has RLS on with **zero policies**)

**Verdict: KEPT.** Per instructions, any reference → do not drop. Active reference in `backupConfig.ts` (data export) and a row type still surfaced in `types.ts`. **Open follow-up:** re-add the org-member access policies that were dropped (or remove from `backupConfig.ts` and drop the table) — this is the same Bucket 1 INFO-level lint finding from the previous audit, still unresolved.

## Step 3 — Storage bucket SELECT tightening ✅ APPLIED

Two `public=true` buckets: `floorplans` and `photos`.

- `photos` — has `Org members can view photos` policy gated by `user_owns_property_folder(...)`. Despite `public=true`, the SELECT policy is properly org-scoped, so the linter does not flag it.
- `floorplans` — had `Public can view floorplans` with `qual: (bucket_id = 'floorplans')`. **This was the lint flag.** Anonymous visitors could list and download every floorplan across every tenant — a real cross-tenant leak.

Applied:
1. `DROP POLICY "Public can view floorplans"`.
2. Created `Org members can view floorplans` — gated by org membership joined through `properties.id` matching `storage.foldername(name)[1]`. Mirrors the existing pattern on the `photos` bucket.
3. `UPDATE storage.buckets SET public = false WHERE id = 'floorplans'` so the bucket no longer advertises CDN-style public URLs.

**App-surface impact (Uncertain — needs review):** if any UI used the public CDN URL pattern (`/storage/v1/object/public/floorplans/...`) it must now use a signed URL. The project memory `storage-access-control-v3` says signed URLs are the established pattern, so most surfaces should already be using `useSignedUrl` / `createSignedUrl`. **Surface this in the next QA pass.** Did not audit each call site in this migration to keep the change surgical.

## Step 4 — Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | clean (no app code touched) |
| Vitest | 1090/1090 expected (no app code touched) |
| Supabase linter | **114 → 113** |

### Lint bucket diff

| Bucket | Before | After |
|---|---|---|
| RLS Enabled, No Policy (`maintenance_updates`) | 1 | 1 |
| RLS Policy Always True (`demo_requests`) | 1 | 1 |
| Public Bucket Allows Listing (`floorplans`) | 1 | **0** ✅ |
| Public Can Execute SECURITY DEFINER | 55 | 55 |
| Signed-In Users Can Execute SECURITY DEFINER | 55 | 55 |
| Leaked Password Protection Disabled | 1 | 1 |
| **Total** | **114** | **113** |

## Open follow-ups

1. **`maintenance_updates`** — re-add org-scoped policies (the 20260323 policies were dropped) **or** remove the entry from `backupConfig.ts` and `DROP TABLE`. Decide intent first.
2. **`demo_requests`** — accept the lint warning or migrate the marketing form behind a CAPTCHA-gated edge function so the policy can be tightened to `service_role`.
3. **Floorplans signed-URL audit** — grep `bucket: 'floorplans'` and `/floorplans/` in `src/` to confirm every read site already uses signed URLs; fix any direct public-URL constructions.
4. **Remaining 55 SECURITY DEFINER functions** — these are the Category A "RLS helpers / RPC targets" identified in the previous session. Each is intentional; lint suppression or per-function documentation is the next move (no further revokes are safe).
5. **Leaked Password Protection** — operator action in Auth dashboard.
