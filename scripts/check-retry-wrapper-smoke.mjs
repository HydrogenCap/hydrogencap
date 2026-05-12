#!/usr/bin/env node
/**
 * check-retry-wrapper-smoke.mjs — integration smoke for run-with-retry.mjs.
 *
 * Spawns the wrapper against the deterministic fixture
 * (scripts/__fixtures__/retry-smoke-cmd.mjs) which fails twice with
 * ECONNRESET then succeeds. Asserts:
 *   - wrapper exits 0
 *   - 3 attempts were made (state file shows 4 = next attempt)
 *   - total wall time < 100s (default; backoff overridden to 50ms for speed)
 *
 * Uses a sandboxed temp file for the fixture's state so concurrent CI runs
 * never race on the same file.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const sandbox = mkdtempSync(join(tmpdir(), 'retry-smoke-'));
const stateFile = join(sandbox, 'attempts.txt');

const start = Date.now();
const result = spawnSync(
  process.execPath,
  [
    join(root, 'scripts/run-with-retry.mjs'),
    '--max=3',
    '--backoff=50,50,50',
    '--',
    process.execPath,
    join(root, 'scripts/__fixtures__/retry-smoke-cmd.mjs'),
  ],
  {
    encoding: 'utf8',
    env: { ...process.env, RETRY_SMOKE_STATE: stateFile },
    timeout: 100_000,
  },
);
const elapsedMs = Date.now() - start;

const failures = [];

if (result.status !== 0) {
  failures.push(`expected exit 0, got ${result.status}`);
}

let attempts = 0;
if (existsSync(stateFile)) {
  attempts = Number(readFileSync(stateFile, 'utf8').trim()) - 1;
}
if (attempts !== 3) {
  failures.push(`expected 3 attempts, got ${attempts}`);
}

if (elapsedMs > 100_000) {
  failures.push(`expected <100s wall time, got ${elapsedMs}ms`);
}

if (!/smoke-ok/.test(result.stdout || '')) {
  failures.push(`expected "smoke-ok" in stdout, got: ${(result.stdout || '').slice(0, 200)}`);
}

rmSync(sandbox, { recursive: true, force: true });

if (failures.length > 0) {
  console.error('\n❌ retry-wrapper smoke check FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  console.error(`\n  stdout: ${(result.stdout || '').slice(0, 500)}`);
  console.error(`  stderr: ${(result.stderr || '').slice(0, 500)}`);
  process.exit(1);
}

console.log(`✓ retry-wrapper smoke: 3 attempts, exit 0, ${elapsedMs}ms wall time.`);
