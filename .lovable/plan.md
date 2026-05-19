# Performance & Polish — Full Epic

## Baseline (measured this session)

- **LCP 19,772 ms** (budget 2,500 ms) — ~8× over budget
- **CLS 0 ms** — already green
- **Console warnings on every load**: icon-only `<Button>` missing `aria-label`, unknown `RESET_BLANK_CHECK` message
- **Bundle topology**: 104 lazy routes in `App.tsx` (good), but `vendor-charts` (recharts) is force-chunked even though it's only used by 10 files, several behind dynamic flows. Map/PDF/ZIP correctly left to rollup auto-split.
- **Dashboard hook**: `useDashboardDataV2` already exists with three `useQuery` blocks; opportunity to parallelise and prefetch.

## Why LCP is 19.7s (working theory, to confirm with profiler)

The dashboard is gated behind `ProtectedRoute` → auth round-trip → `useUserOrg` → three serial-ish queries → first paint. Combined with eager `vendor-charts` chunk and Helmet hydration, the LCP candidate (the first KPI card) waits on the full data tree. Standard fix is **render-then-fetch** with skeletons measured as LCP, plus parallel query fan-out and resource hints.

## Phase 1 — Diagnose (S, ~1h, blocks others)

1. Run `browser--performance_profile` on `/dashboard` after a hard reload; capture LCP element, long tasks, transfer sizes.
2. Build the bundle with `VITE_ANALYZE=true` and read `dist/bundle-report.html` to identify the actual top-10 modules by gzipped size.
3. Capture three traces: cold cache, warm cache, throttled "Fast 3G".
4. Output: a short `docs/perf-baseline-2026-05.md` with numbers so Phase 5 can verify deltas.

## Phase 2 — Critical-path wins (M, ~3h)

1. **Skeleton-first dashboard**: render the KPI grid + header immediately with skeletons sized to final dimensions (CLS stays 0). LCP candidate becomes the H1, which paints on first frame.
2. **Parallelise queries**: convert serial `useQuery` chains in `useDashboardDataV2` to `useQueries`, batched off `org_id`. Combine the auth + org bootstrap into a single `useQuery({ queryKey: ['bootstrap'] })` so route children don't each wait.
3. **Prefetch on auth success**: in the auth flow, `queryClient.prefetchQuery(['dashboard', orgId])` while the protected-route gate is still resolving.
4. **Resource hints**: add `<link rel="preconnect">` for the Supabase URL and `<link rel="preload" as="font">` for the one display font used above the fold.
5. **Suspense boundary**: wrap heavy panels (Compliance heatmap, charts) in their own boundaries so they don't block LCP.

## Phase 3 — Bundle diet (M, ~3h)

1. **Recharts on-demand**: drop the `vendor-charts` manual chunk; charts are only on PortalDashboard, LocationRegistryCard, InvestorStatement, PropertyMap. Let rollup auto-split. Verify recharts doesn't appear in the dashboard's initial preload waterfall.
2. **Lazy chart wrappers**: convert remaining eager `import` of recharts in any dashboard widget to `lazy()`.
3. **Lucide tree-shake check**: confirm icons import from `lucide-react` (named) — flag any namespace imports.
4. **Date-fns audit**: confirm sub-path imports (`date-fns/format`) where possible; the `vendor-date` chunk swallows the whole package today.
5. **Image audit**: any `>100 KB` images in `public/` and `src/assets/` → convert with `vite-imagetools` to AVIF/WebP variants.

## Phase 4 — Polish & a11y (S, ~2h)

1. **Icon-button audit**: fix the console-warning source by adding `aria-label` to every `<Button size="icon">` (the warning's stack points at `button.tsx` — find call-sites with `rg "size=\"icon\"" src` and label each).
2. **Loading/empty/error states**: standard `EmptyState` and `ErrorState` components used everywhere a `useQuery` resolves to `[]` or error. Audit the top-12 most-visited pages.
3. **`RESET_BLANK_CHECK` warning**: trace and suppress at the `lovable.js` boundary — likely a stale postMessage handler.
4. **Focus rings**: visible focus on all interactive elements (some custom `Button` variants drop the ring).
5. **Reduced motion**: respect `prefers-reduced-motion` on the dashboard animations.

## Phase 5 — Verify & ship guardrails (S, ~1h)

1. Re-run Phase 1's profile; assert LCP < 4s on warm cache, < 6s cold (mid-tier mobile).
2. Lighthouse CI step in the existing GitHub workflow with budgets matching `src/lib/performance-budget.ts`.
3. Update `docs/perf-baseline-2026-05.md` with before/after numbers.
4. Memory note: capture any new patterns (skeleton-first, prefetch-on-auth) under `mem://architecture/`.

## Out of scope

- Server-side rendering / prerendering of the app shell
- Database index tuning (separate plan if Phase 1 profiling shows query time dominates)
- Rewriting any V2 schema

## Stop-and-ask checkpoints

- **After Phase 1**: surface measured top bottleneck. If it's *network* (Supabase latency) not *bundle*, swap Phase 3 for an edge-function/caching plan.
- **Before Phase 3 manual-chunk change**: confirm — removing `vendor-charts` chunk is low risk but visible in build output.
- **Before Lighthouse CI** in Phase 5: confirm GitHub Actions minutes budget is OK.

## Sizing summary

| Phase | Size | Blocks |
|---|---|---|
| 1 Diagnose | S | Yes — sets Phase 2 priorities |
| 2 Critical path | M | No |
| 3 Bundle diet | M | No |
| 4 Polish & a11y | S | No |
| 5 Verify | S | After 2–4 |

Total: ~10 working hours across 2–3 ship windows.
