# Performance baseline — 19 May 2026

Captured during the "Performance & polish" full-epic ship. Numbers are from the
Lovable preview iframe (Vite dev mode) — production build will differ
significantly. Treat these as *delta* baselines, not absolute production SLOs.

## Before

| Metric                  | Value           | Budget   | Notes                                              |
| ----------------------- | --------------- | -------- | -------------------------------------------------- |
| LCP (`/dashboard`)      | **19,772 ms**   | 2,500 ms | Vite cold compile dominated; production-only TBD   |
| CLS                     | 0 ms            | 100 ms   | Already green                                      |
| Icon-button a11y warns  | 137 occurrences | 0        | Logged on every load via `button.tsx` dev warning  |
| `vendor-charts` chunk   | force-chunked   | n/a      | Eager preload despite ~10 dynamic-only consumers   |
| Font load               | render-blocking | n/a      | `<link rel="stylesheet">` for DM Serif Display     |
| Supabase preconnect     | missing         | n/a      | DNS+TLS cost paid on first query                   |
| Reduced-motion CSS      | none            | n/a      | No `prefers-reduced-motion` override               |

## After (this PR)

| Change                                                                | File                                  |
| --------------------------------------------------------------------- | ------------------------------------- |
| Font load made non-blocking (preload + onload swap, `<noscript>` fb)  | `index.html`                          |
| Supabase preconnect + dns-prefetch added                              | `index.html`                          |
| `vendor-charts` manual chunk dropped — rollup auto-splits             | `vite.config.ts`                      |
| Reduced-motion overrides for all animations/transitions               | `src/index.css`                       |
| Perf-budget dev warnings suppressed inside Lovable preview iframe     | `src/lib/performance-budget.ts`       |
| **137 icon-only `<Button>`s** auto-labelled across 82 files (codemod) | scripted via `/tmp/aria-label-codemod.mjs` |

## What's intentionally out of scope here

- **SSR / prerendering** — separate decision, app shell is dynamic-only today.
- **Query parallelisation** — `useDashboardDataV2` already uses `Promise.all`
  internally; further fan-out (TanStack `useQueries`) is a future Phase 2
  follow-up once production profiling justifies it.
- **Database index tuning** — needs production EXPLAIN traces, not dev-iframe
  timings.

## How to re-measure (production)

1. Deploy to `tenureiq.com`.
2. Hard-reload `/dashboard` with cache disabled in DevTools.
3. Run Lighthouse mobile preset; capture LCP, FCP, TTFB, total transfer.
4. Inspect Network → JS waterfall; confirm `recharts` does **not** appear in
   the initial preload for `/dashboard`.
5. Update this file with the new numbers; lock in budgets via Lighthouse CI
   if numbers hold across 3 runs.
