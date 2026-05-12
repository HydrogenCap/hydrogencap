import { describe, it, expect } from 'vitest';
import { runWithRetry, isTransient, hasFailFast, TRANSIENT_PATTERNS, FAIL_FAST_PATTERNS } from '../../scripts/run-with-retry.mjs';

const noSleep = () => Promise.resolve();

function makeRunner(results: Array<{ code: number; output: string }>) {
  let i = 0;
  const calls: number[] = [];
  const runner = async () => {
    const r = results[Math.min(i, results.length - 1)];
    calls.push(i);
    i++;
    return r;
  };
  return { runner, getCalls: () => calls };
}

describe('run-with-retry', () => {
  it('TRANSIENT_PATTERNS catches deno.land 5xx and socket errors', () => {
    expect(isTransient('error: error sending request for url (https://deno.land/std@0.x/x.ts)')).toBe(true);
    expect(isTransient('deno.land returned 502 Bad Gateway')).toBe(true);
    expect(isTransient('Error: connect ECONNRESET 1.2.3.4:443')).toBe(true);
    expect(isTransient('getaddrinfo ENOTFOUND deno.land')).toBe(true);
    expect(isTransient('tcp connect error: connection refused')).toBe(true);
    expect(isTransient('connection closed before message completed')).toBe(true);
    expect(TRANSIENT_PATTERNS.length).toBeGreaterThan(3);
  });

  it('does not flag legitimate type errors as transient', () => {
    expect(isTransient("error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.")).toBe(false);
    expect(isTransient('error: Uncaught TypeError: x.y is not a function')).toBe(false);
    expect(isTransient('AssertionError: expected 1 to equal 2')).toBe(false);
  });

  it('retries on transient failure then succeeds → exit 0', async () => {
    const { runner, getCalls } = makeRunner([
      { code: 1, output: 'fetch https://deno.land/x/foo failed' },
      { code: 1, output: 'deno.land returned 503' },
      { code: 0, output: 'ok' },
    ]);
    const code = await runWithRetry({ cmd: 'x', args: [], max: 3, backoff: [0, 0, 0], runner, sleep: noSleep });
    expect(code).toBe(0);
    expect(getCalls().length).toBe(3);
  });

  it('exhausts attempts on persistent transient failure → exit non-zero', async () => {
    const { runner, getCalls } = makeRunner([
      { code: 1, output: 'ECONNRESET' },
      { code: 1, output: 'ECONNRESET' },
      { code: 1, output: 'ECONNRESET' },
    ]);
    const code = await runWithRetry({ cmd: 'x', args: [], max: 3, backoff: [0, 0, 0], runner, sleep: noSleep });
    expect(code).toBe(1);
    expect(getCalls().length).toBe(3);
  });

  it('exits immediately on non-transient error (no retry mask)', async () => {
    const { runner, getCalls } = makeRunner([
      { code: 2, output: "error TS2345: Argument of type 'string' is not assignable" },
      { code: 0, output: 'should-not-reach' },
    ]);
    const code = await runWithRetry({ cmd: 'x', args: [], max: 3, backoff: [0, 0, 0], runner, sleep: noSleep });
    expect(code).toBe(2);
    expect(getCalls().length).toBe(1);
  });

  // === #108 hardening: fail-fast precedence over transient-shaped substrings ===

  describe('FAIL_FAST_PATTERNS precedence over transient matchers', () => {
    it('hasFailFast catches all known real-bug shapes', () => {
      expect(hasFailFast('error: TypeError: cannot read x of undefined')).toBe(true);
      expect(hasFailFast('TypeError: foo is not a function')).toBe(true);
      expect(hasFailFast('AssertionError: expected x')).toBe(true);
      expect(hasFailFast('SyntaxError: Unexpected token')).toBe(true);
      expect(hasFailFast('ReferenceError: foo is not defined')).toBe(true);
      expect(hasFailFast('error TS2345: bad arg')).toBe(true);
      expect(hasFailFast('foo.ts(12,3): error TS2322: type mismatch')).toBe(true);
      expect(hasFailFast(' FAIL  src/foo.test.ts > suite > test')).toBe(true);
      expect(hasFailFast('Expected: "a"\nReceived: "b"')).toBe(true);
      expect(FAIL_FAST_PATTERNS.length).toBeGreaterThan(5);
    });

    it('TypeError mentioning deno.land in stack trace → NOT transient', () => {
      const output = `error: Uncaught TypeError: Cannot read properties of undefined
    at parseConfig (https://deno.land/std@0.x/cli/parse.ts:42:1)
    at <anonymous>:1:1`;
      expect(isTransient(output)).toBe(false);
    });

    it('AssertionError diff containing ETIMEDOUT literal → NOT transient', () => {
      const output = `AssertionError: expected error code to equal "ECONNREFUSED"
- Expected: "ECONNREFUSED"
+ Received: "ETIMEDOUT"`;
      expect(isTransient(output)).toBe(false);
    });

    it('vitest assertion against "5xx" string literal → NOT transient', () => {
      const output = ` FAIL  src/api.test.ts > handles deno.land 5xx
AssertionError: expected response to match
Expected: "deno.land returned 5xx error"
Received: "ok"`;
      expect(isTransient(output)).toBe(false);
    });

    it('exits immediately when output has BOTH transient + fail-fast pattern (1 attempt)', async () => {
      const { runner, getCalls } = makeRunner([
        // Looks like a deno.land 502, but stack also has a real TypeError —
        // fail-fast wins, no retry.
        { code: 1, output: `error: Uncaught TypeError: x is not a function
  at fetch (https://deno.land/std@0.x/http/mod.ts:1:1)
  deno.land returned 502 Bad Gateway` },
        { code: 0, output: 'should-not-reach' },
      ]);
      const code = await runWithRetry({ cmd: 'x', args: [], max: 3, backoff: [0, 0, 0], runner, sleep: noSleep });
      expect(code).toBe(1);
      expect(getCalls().length).toBe(1);
    });

    it('exits immediately when vitest FAIL contains ECONNRESET in diff', async () => {
      const { runner, getCalls } = makeRunner([
        { code: 1, output: ` FAIL  src/net.test.ts > retry behaviour
AssertionError: expected to receive ECONNRESET
- Expected: "ECONNRESET"
+ Received: "ETIMEDOUT"` },
        { code: 0, output: 'should-not-reach' },
      ]);
      const code = await runWithRetry({ cmd: 'x', args: [], max: 3, backoff: [0, 0, 0], runner, sleep: noSleep });
      expect(code).toBe(1);
      expect(getCalls().length).toBe(1);
    });
  });
});
