#!/usr/bin/env node
/**
 * run-with-retry.mjs — retry a command on transient network failures.
 *
 * Usage:
 *   node scripts/run-with-retry.mjs [--max=3] [--backoff=5000,15000,45000] -- <cmd> [args...]
 *
 * Exits with the final attempt's exit code. Only retries when the command
 * exits non-zero AND its combined stdout/stderr matches a known transient
 * pattern (deno.land 5xx, ECONNRESET, ETIMEDOUT, fetch failures). Any other
 * non-zero exit (e.g. real type error) fails immediately — no retry mask.
 */
import { spawn } from 'node:child_process';

// Transient-error matchers. Conservative on purpose: only network/registry
// failures fetching deno.land or generic socket errors. Type errors, syntax
// errors, and assertion failures will NOT match these and exit immediately.
export const TRANSIENT_PATTERNS = [
  /fetch.*deno\.land/i,
  /deno\.land.*\b5\d{2}\b/i,
  /\b(ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|ECONNREFUSED)\b/,
  /error sending request/i,
  /connection (closed|reset) before message completed/i,
  /tcp connect error/i,
];

export function isTransient(output) {
  return TRANSIENT_PATTERNS.some((re) => re.test(output));
}

function parseArgs(argv) {
  let max = 3;
  let backoff = [5000, 15000, 45000];
  const rest = [];
  let i = 0;
  for (; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { i++; break; }
    if (a.startsWith('--max=')) max = Number(a.slice(6));
    else if (a.startsWith('--backoff=')) backoff = a.slice(10).split(',').map(Number);
    else { rest.push(a); }
  }
  for (; i < argv.length; i++) rest.push(argv[i]);
  if (rest.length === 0) {
    console.error('run-with-retry: no command provided');
    process.exit(2);
  }
  return { max, backoff, cmd: rest[0], args: rest.slice(1) };
}

export function runOnce(cmd, args, { spawnImpl = spawn } = {}) {
  return new Promise((resolve) => {
    const child = spawnImpl(cmd, args, { stdio: ['inherit', 'pipe', 'pipe'] });
    let buf = '';
    child.stdout.on('data', (d) => { const s = d.toString(); buf += s; process.stdout.write(s); });
    child.stderr.on('data', (d) => { const s = d.toString(); buf += s; process.stderr.write(s); });
    child.on('exit', (code) => resolve({ code: code ?? 1, output: buf }));
    child.on('error', (err) => resolve({ code: 1, output: String(err) }));
  });
}

export async function runWithRetry({ cmd, args, max, backoff, runner = runOnce, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  let attempt = 0;
  while (true) {
    attempt++;
    const { code, output } = await runner(cmd, args);
    if (code === 0) return 0;
    if (attempt >= max || !isTransient(output)) return code;
    const delay = backoff[Math.min(attempt - 1, backoff.length - 1)] ?? 5000;
    console.error(`\n[run-with-retry] transient failure detected (attempt ${attempt}/${max}); retrying in ${delay}ms...`);
    await sleep(delay);
  }
}

const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  const { max, backoff, cmd, args } = parseArgs(process.argv.slice(2));
  runWithRetry({ cmd, args, max, backoff }).then((code) => process.exit(code));
}
