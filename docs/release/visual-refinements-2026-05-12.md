# Visual refinements §5.5 shipped — 2026-05-12

Plan §5.5 trio. Doc-only on Items A and B (audit revealed the structural
work was already done). Item C deferred pending font-weight decision.

## Item A — Tame the glow ✅ doc-only

**Before:** `glow-primary` / `glow-success` / `glow-warning` / `glow-danger`
defined in `src/index.css` with no scope guidance. Risk of bleeding into
dense data pages over time.

**Audit finding:** only **2 actual usages** in `src/` — both auth pages
(`ForgotPassword.tsx`, `ResetPassword.tsx`). Zero on dense data pages. No
sweep needed.

**After:** added a multi-line CSS comment above the `.glow-*` block in
`src/index.css` documenting the scope: badges + key CTAs only, never on
tables/lists/kanbans/dashboards. Suggests `ring`/`border` tokens as the
escape hatch when emphasis is needed on data pages.

**Files touched:** `src/index.css` (lines 241-247, comment only).

## Item B — Chart palette split ✅ doc-only

**Before:** `--chart-1` through `--chart-5` defined as ordinal performance
band; `--cat-1` through `--cat-6` defined as qualitative categorical ramp.
Tailwind `colors.chart.*` and `colors.cat.*` already mapped in
`tailwind.config.ts`. No comment warning future authors against mixing the
two.

**Audit finding:** **zero direct `var(--chart-*)` consumers** in `src/`
outside the shadcn `components/ui/chart.tsx` shell. Nothing currently
misuses `--chart-*` for categorical data. No consumer migration needed.

**After:** added intent-locking comments to both blocks in `src/index.css`:
- `--chart-*` block now states "ORDINAL data only. NEVER mix with --cat-*
  in the same chart, and NEVER use --chart-* for categorical encoding".
- `--cat-*` block points authors at the `bg-cat-1`..`bg-cat-6` Tailwind keys.

**Files touched:** `src/index.css` (lines 72-86, comments only).

## Item C — Typography hierarchy ⏸ deferred

**Audit finding:** `font-display` Tailwind variant + DM Serif Display loader
already in place (used in 6 marketing files + `LogoWordmark.tsx`). Sweep
target: ~30 page-level h1s + ~25 KPI tile candidates (`text-2xl/3xl/4xl
font-bold`) across `src/pages` + `src/components` — total ~55 sites.

**STOP gate (c) — confirmed real:** font loader pulls `DM+Serif+Display` with
no weight specifier. DM Serif Display is a **regular-only family at Google
Fonts** — there is no 500/600 weight. If 400 reads thin at `text-4xl` for
KPI numbers, the only options are accepting it, switching to a different
display face for KPIs (Playfair Display 600, Cormorant 700), or keeping KPI
numbers in Inter `font-bold`.

**Decision (this ship):** defer Item C until the font-weight question is
resolved. No changes shipped.

**Re-open trigger:** product chooses one of:
1. Apply `font-display` to h1s only, keep KPI tiles in Inter `font-bold`
   (safest — no font-loader change).
2. Apply `font-display` to both, accept 400 weight for KPI numbers.
3. Add a second display face (e.g. Playfair Display 600) and a
   `font-display-numeric` variant for KPI tiles only.

## Files changed

- `src/index.css` — comment-only edits at lines 72-86 (chart vs cat) and
  241-247 (glow scope).
- `docs/release/visual-refinements-2026-05-12.md` — this file.
