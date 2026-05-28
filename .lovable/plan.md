## Fix npm ERESOLVE by downgrading ESLint to v9

### Problem
`npm install` fails with `ERESOLVE` because:
- `package.json` pins `eslint@^10.1.0` and `@eslint/js@^10.0.1`
- `eslint-plugin-react-hooks@7.0.1` only declares peer support up to `eslint@^9`

### Changes

1. **`package.json`** — update two devDependencies only:
   - `"eslint": "^10.1.0"` → `"eslint": "^9.36.0"`
   - `"@eslint/js": "^10.0.1"` → `"@eslint/js": "^9.36.0"`

2. **Regenerate lockfiles** (the repo has `package-lock.json`, `bun.lock`, and `bun.lockb`):
   - `rm -f package-lock.json bun.lock bun.lockb`
   - `npm install` (regenerates `package-lock.json`, must succeed without ERESOLVE)
   - `bun install` (regenerates `bun.lock` + `bun.lockb`)

3. **No change to `eslint.config.js`** — the existing flat config is already compatible with ESLint 9.

### Verification

Run the full verify chain and confirm all stay green:
- `npm install` — completes without ERESOLVE
- `npm run lint`
- `npm run typecheck` (or `tsc --noEmit` via the project's script)
- `npm test` (vitest)
- `npm run build`

If any step fails, stop and report the failure rather than papering over it.

### Notes
- Strictly two version bumps + lockfile regeneration. No other source files touched.
- Memory rule #1 (React 19 / current stack) unaffected; this is a tooling-only change.