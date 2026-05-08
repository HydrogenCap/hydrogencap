#!/usr/bin/env node
/**
 * Re-runs the a11y smoke spec with A11Y_WRITE_BASELINE=1 and rewrites
 * `e2e/a11y-baseline.json` from the actual moderate/minor counts the
 * spec computes. The spec itself does the writes (one entry per case);
 * this wrapper just sets the env var and forwards stdio.
 *
 * Usage: npm run a11y:update-baseline
 *
 * Requires E2E_AUTH_EMAIL / E2E_AUTH_PASSWORD in env (same as the spec).
 */
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'npx',
  ['playwright', 'test', 'e2e/a11y.smoke.spec.ts', '--reporter=list'],
  { stdio: 'inherit', env: { ...process.env, A11Y_WRITE_BASELINE: '1' } },
);
process.exit(result.status ?? 1);
