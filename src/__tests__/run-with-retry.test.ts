import { describe, it, expect } from 'vitest';
import { runWithRetry, isTransient, TRANSIENT_PATTERNS } from '../../scripts/run-with-retry.mjs';

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
    expect(TRANSIENT_PATTERNS.length).toBeGreaterThan(3);
  });

  it('does not flag legitimate type errors as transient', () => {
    expect(isTransient("TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.")).toBe(false);
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
      { code: 2, output: "TS2345: Argument of type 'string' is not assignable" },
      { code: 0, output: 'should-not-reach' },
    ]);
    const code = await runWithRetry({ cmd: 'x', args: [], max: 3, backoff: [0, 0, 0], runner, sleep: noSleep });
    expect(code).toBe(2);
    expect(getCalls().length).toBe(1);
  });
});
