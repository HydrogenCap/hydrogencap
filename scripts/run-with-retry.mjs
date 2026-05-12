#!/usr/bin/env node
/**
 * run-with-retry.mjs — retry a command on transient network failures.
 *
 * Usage:
 *   node scripts/run-with-retry.mjs [--max=3] [--backoff=5000,15000,45000] -- <cmd> [args...]
 *
 * Exits with the final attempt's exit code. Only retries when:
 *   1. The command exited non-zero, AND
 *   2. The combined stdout/stderr matches a TRANSIENT_PATTERN, AND
 *   3. NO FAIL_FAST_PATTERN is present (precedence: real bugs always win).
 *
 * Hardening pass (#108, 2026-05-12): added FAIL_FAST_PATTERNS so that a
 * vitest assertion or TS error mentioning "deno.land"/"ETIMEDOUT" inside an
 * asserted-value diff doesn't spuriously trigger a retry.
 */
import { spawn } from 'node:child_process';

/**
 * Transient-error matchers. Each entry is genuinely network/registry shaped.
 * If any of these match AND no FAIL_FAST_PATTERN matches, retry.
 */
export const TRANSIENT_PATTERNS = [
  /**
   * Deno fetching a remote module from deno.land.
   * Safe: this string only appears in Deno's import-resolution error path.
   * Risk: a TS source file with a `// fetch from deno.land` comment in a
   *   stack trace — guarded by FAIL_FAST (TypeError/SyntaxError beats this).
   * Fixture: 'error: error sending request for url (https://deno.land/...)'
   */
  /fetch.*deno\.land/i,
  /**
   * deno.land HTTP 5xx response.
   * Safe: HTTP 5xx is by definition server-side transient.
   * Risk: an assertion-value diff containing the literal "5xx" near the
   *   word "deno.land" — guarded by FAIL_FAST (AssertionError beats this).
   * Fixture: 'deno.land returned 502 Bad Gateway'
   */
  /deno\.land.*\b5\d{2}\b/i,
  /**
   * POSIX socket error codes from libuv / node net.
   * Safe: these are kernel-level transient network failures, not
   *   application errors. Word-boundary anchored to avoid matching e.g.
   *   "MyECONNRESETError" inside a custom error class name.
   * Risk: a vitest assertion diff that includes a socket code as a string
   *   literal — guarded by FAIL_FAST.
   * Fixture: 'Error: connect ECONNRESET 1.2.3.4:443'
   */
  /\b(ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|ECONNREFUSED)\b/,
  /**
   * Generic Deno/reqwest "error sending request" — wraps DNS/socket/TLS.
   * Safe: phrase only emitted by the request stack on transport failure.
   * Risk: low — exact phrase isn't a typical app-error idiom.
   * Fixture: 'error: error sending request for url'
   */
  /error sending request/i,
  /**
   * HTTP/2 / chunked-transfer mid-flight reset.
   * Safe: only emitted by the HTTP client when a connection drops.
   * Risk: low — phrase is not a typical app-error idiom.
   * Fixture: 'connection closed before message completed'
   */
  /connection (closed|reset) before message completed/i,
  /**
   * Reqwest/hyper TCP-layer connect failure.
   * Safe: only emitted on TCP handshake failure.
   * Risk: low — phrase is specific to network stack.
   * Fixture: 'tcp connect error: connection refused'
   */
  /tcp connect error/i,
];

/**
 * Fail-fast precedence (#108 hardening). If ANY of these appear in the
 * combined output, treat the failure as a real bug and EXIT IMMEDIATELY,
 * even if a TRANSIENT_PATTERN also matches. Real bugs always win over
 * transient-shaped substrings inside their own diff/stack traces.
 */
export const FAIL_FAST_PATTERNS = [
  /\berror:\s+TypeError\b/,        // Deno/Node thrown TypeError
  /\bTypeError:/,                  // bare "TypeError: x is not a function"
  /\bAssertionError:/,             // vitest/chai/node:assert
  /\bSyntaxError:/,                // parse-time error
  /\bReferenceError:/,             // bare reference error
  /\bTS\d{4}:/,                    // tsc diagnostic codes (TS2345, TS2322, …)
  /\berror\sTS\d{4}\b/i,           // tsc CLI form: "error TS2345"
  /\b(FAIL|✗)\b.*\.test\.[tj]sx?/, // vitest "FAIL src/foo.test.ts"
  /\bExpected:.*\bReceived:/s,     // jest/vitest assertion diff block
];

export function hasFailFast(output) {
  return FAIL_FAST_PATTERNS.some((re) => re.test(output));
}

export function isTransient(output) {
  if (hasFailFast(output)) return false;
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
