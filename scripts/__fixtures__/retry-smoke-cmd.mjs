#!/usr/bin/env node
/**
 * retry-smoke-cmd.mjs — deterministic fixture for run-with-retry smoke check.
 *
 * Behaviour: maintains an attempt counter in a state file (path passed via
 * RETRY_SMOKE_STATE env var, MUST be a sandboxed temp file from the smoke
 * driver to avoid concurrent-run races). On invocation:
 *   - attempt 1 → exit 1 with stderr "ECONNRESET" (transient, should retry)
 *   - attempt 2 → exit 1 with stderr "ECONNRESET" (transient, should retry)
 *   - attempt 3 → exit 0 with stdout "smoke-ok"
 *
 * The state file is written with the next attempt number after each call.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const stateFile = process.env.RETRY_SMOKE_STATE;
if (!stateFile) {
  console.error('retry-smoke-cmd: RETRY_SMOKE_STATE env var required');
  process.exit(2);
}

let attempt = 1;
if (existsSync(stateFile)) {
  const raw = readFileSync(stateFile, 'utf8').trim();
  attempt = Number(raw) || 1;
}
writeFileSync(stateFile, String(attempt + 1));

if (attempt < 3) {
  process.stderr.write(`Error: connect ECONNRESET 1.2.3.4:443 (smoke attempt ${attempt})\n`);
  process.exit(1);
} else {
  process.stdout.write('smoke-ok\n');
  process.exit(0);
}
