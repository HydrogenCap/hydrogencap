# e2e-results/

Generated test artifacts. Layout:

- `axe/<ISO-date>/<route-slug>-<mode>.html` — per-case axe-core HTML reports
  produced by `e2e/a11y.smoke.spec.ts`. One file per route × theme mode.
- Date directory is the UTC date the run started; safe to keep multiple days
  side-by-side for trend comparison.

This whole directory is gitignored — see top-level `.gitignore`.
