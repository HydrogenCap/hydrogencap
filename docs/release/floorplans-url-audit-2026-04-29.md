# Floorplans URL Audit — 2026-04-29

**Context:** The `floorplans` storage bucket was switched to private (`buckets.public = false`, org-scoped path RLS) in tonight's security pass. This audit verifies no surface still depends on the public CDN URL pattern.

## Method

```bash
grep -rn -E "object/public/floorplans|getPublicUrl.*floorplans" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.html" --include="*.md" \
  src/ supabase/ public/ docs/
grep -rn "floorplan" supabase/functions/
grep -rn -E "floorplan.*file_url|primaryFloorplan\." --include="*.ts" --include="*.tsx" src/
```

## Findings — Frontend (src/)

### (a) Literal `/storage/v1/object/public/floorplans` strings
**Found: 0** (only one informational match in `docs/release/security-hardening-2026-04-29.md`, the predecessor doc).

### (b) `supabase.storage.from('floorplans').getPublicUrl(...)` calls
**Found: 0.**

### (c) Helpers/hooks/utils returning a floorplan URL
| File | Line | Pattern | Status |
|------|------|---------|--------|
| `src/hooks/useFloorplans.ts` | 29-35 | `resolveFloorplanUrls` → `createSignedStorageUrl('floorplans', file_url)` | ✅ already signed (1h TTL via `createSignedStorageUrl` default) |
| `src/hooks/useFloorplans.ts` | 41-58 | `useFloorplans(propertyId)` returns rows with signed `file_url` | ✅ |
| `src/hooks/useFloorplans.ts` | 60-79 | `usePrimaryFloorplan(propertyId)` returns row with signed `file_url` | ✅ |
| `src/lib/storagePaths.ts` | 19-37 | `createSignedStorageUrl(bucketName, fileUrl, expiresIn=3600)` — generic helper, calls `createSignedUrl` | ✅ |

### Floorplan URL consumers (all read `file_url` from the hooks above)
| File | Line | Use |
|------|------|-----|
| `src/components/floorplans/FloorplanCard.tsx` | 112 | `link.href = floorplan.file_url` (download anchor) — ✅ signed |
| `src/components/floorplans/FloorplanCard.tsx` | 259 | `<img src={selectedFloorplan.file_url}>` — ✅ signed |
| `src/components/floorplans/FloorplanCard.tsx` | 265 | `<iframe src={selectedFloorplan.file_url}>` (PDF viewer) — ✅ signed |
| `src/components/floorplans/FloorplanCard.tsx` | 314 | `<img src={floorplan.file_url}>` (thumbnail) — ✅ signed |
| `src/components/property/PropertyMediaHeader.tsx` | 108 | `link.href = primaryFloorplan.file_url` (download) — ✅ signed |
| `src/components/property/PropertyMediaHeader.tsx` | 280 | `<img src={primaryFloorplan.file_url}>` — ✅ signed |
| `src/components/property/PropertyMediaHeader.tsx` | 289 | `<iframe src={primaryFloorplan.file_url}>` (PDF) — ✅ signed |

All consumers receive their `file_url` from `useFloorplans` / `usePrimaryFloorplan`, which already pass each row through `createSignedStorageUrl('floorplans', …)` before returning. **No frontend call site is at risk.**

## Findings — Edge Functions (supabase/functions/)

| File | Line | Pattern | Risk |
|------|------|---------|------|
| `apply-passport-suggestions/index.ts` | 168 | Skips `field_key === 'has_floorplan'` | None — no URL handling |
| `generate-passport-suggestions/index.ts` | 309-323 | Reads `floorplans` table for existence check (`floorplans.length`, `floorplans[0].id`) | None — never fetches the file or builds a URL |

**No edge function downloads, embeds, or links to a floorplan binary.** The PDF passport / report generators do not embed floorplan images. Nothing to migrate.

## Findings — Backup System

`src/lib/backupConfig.ts:64` declares the `floorplans` table+bucket for the portfolio ZIP backup. The backup engine uses `supabase.storage.from('floorplans').download(path)` (authenticated client, per `portfolio-backup-system` memory) — this works on private buckets and needs no change.

## Findings — HTML / Markdown / Public

- `index.html`, `public/**`: **0 hits.**
- `docs/`: 1 informational hit (the security hardening doc that triggered this audit).

## Summary

| Bucket | Found | Fixed | Uncertain |
|--------|------:|------:|----------:|
| Public URL string literals (frontend) | 0 | 0 | 0 |
| `getPublicUrl('floorplans', …)` calls | 0 | 0 | 0 |
| Frontend hooks returning floorplan URL | 2 (`useFloorplans`, `usePrimaryFloorplan`) | 0 — already signed | 0 |
| Frontend consumer call sites | 7 | 0 — already wired through signed-URL hooks | 0 |
| Edge function URL builders / embedders | 0 | 0 | 0 |
| Backup-system surfaces (uses `.download()`) | 1 | 0 — works on private buckets | 0 |

**Net: 0 fixes required.** Tonight's security pass left the floorplans surface clean because the existing `useFloorplans` / `usePrimaryFloorplan` hooks were already routing every row's `file_url` through `createSignedStorageUrl` (1h TTL). Every consumer reads from those hooks, so the bucket flip from public→private is a no-op for the UI.

### New hook — *not created*
The brief proposed extracting a `useFloorplanUrl(path)` hook if multiple call sites needed `createSignedUrl` directly. They don't — all consumers already get signed URLs via the existing query hooks. Adding another hook would be churn without value.

### Edge functions touched
**None.** No edge function reads or serves floorplan bytes.

### Uncertain / flagged
- **None.** No marketing page or unauthenticated surface references the bucket.
- **Untested in preview:** I did not navigate the live preview to a property with an uploaded floorplan to visually confirm a 200 (no 403). Recommend QA spot-check of `/properties-v2/<id-with-floorplan>` → open the floorplan dialog → confirm image/PDF renders. If a 403 surfaces, the most likely cause is the new bucket RLS policy path-prefix not matching the actual stored object keys (audit `floorplans.file_url` rows vs. the policy's `org_id/...` prefix expectation).

## Verification

- `tsc --noEmit`: clean (no edits made).
- Vitest: unchanged at 1090/1090 (no edits made).
- Files changed: **0** code files; 1 audit doc created.
