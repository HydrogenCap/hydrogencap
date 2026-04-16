# Scoped Strict Typecheck

The repo-wide `tsconfig.app.json` runs with `strict: false` for historical
reasons. To re-introduce strictness gradually without a big-bang refactor,
`tsconfig.strict.json` opts in a small allowlist of modules and is enforced
in CI via `npm run typecheck:strict`.

## Goals

- Catch real null-safety and type bugs in the modules that handle money,
  compliance rules, and RLS-adjacent reads.
- Grow the allowlist one or two files per PR rather than one giant migration.
- Never weaken the overall project config — strictness is additive.

## How to opt a file in

1. Run the strict check locally to see the current state:
   ```sh
   npm run typecheck:strict
   ```
2. Add the file's path to the `include` array in `tsconfig.strict.json`.
3. Run the strict check again. Fix any new errors **in the file you added**
   — don't widen types in its imports to paper over issues.
4. If the errors are in a transitive dependency, opt that dependency in too
   (or refactor the shared type into a pure `src/lib/*Types.ts` module that
   can be included without dragging in the full file).
5. Keep tests (`*.test.ts`) out of the allowlist for now — they widen the
   surface area without proportional safety gain.

## Priorities for expansion

Follow the order in `docs/improvement-plan.md` §4.2:

1. `src/lib/*.ts` — pure calculation and schema modules first
   (`calculations.ts`, `workOrderFinancialSync.ts` already in).
2. `src/hooks/useTax*.ts`, `src/hooks/useCompliance*.ts`.
3. `supabase/functions/_shared/` — the edge-function utilities, once the
   contract layer (P0.4) lands.

## Why scoped, not global?

The global codebase has ~2,900 `any` uses and disabled null-checks. Flipping
`strict: true` on `tsconfig.app.json` today would produce thousands of
errors, most of them in components or hooks we'd want to refactor anyway.
The scoped config lets us lock down the critical-path modules now and
expand the surface as each area is cleaned up.
