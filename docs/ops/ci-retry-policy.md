# CI retry policy

How retries work in this repo's CI pipeline — what gets retried, what doesn't, and when to escalate.

## When retries apply

Exactly one verify-chain step wraps through `scripts/run-with-retry.mjs`:

| Script | Wrapper invocation | Why |
|---|---|---|
| `check:edge` | `node scripts/run-with-retry.mjs --max=3 --backoff=5000,15000,45000 -- node scripts/check-edge-functions.mjs` | The Deno typecheck pass that `check-edge-functions.mjs` performs fetches modules from `https://deno.land/...` on every run. deno.land has documented transient 5xx outages. |

No other script in `verify` is wrapped. Lint, vitest, tsc, and the static checkers (`check:no-v1-refs`, `check:freeze-triggers`, `check:no-any-disables`) are pure local computation — there is nothing to retry, and a non-zero exit from any of them is always a real bug.

If a future verify step starts hitting transient external services (npm registry, esm.sh, supabase API), wrap it the same way. Don't reinvent the matcher.

## Transient matcher set

Defined in `scripts/run-with-retry.mjs` as `TRANSIENT_PATTERNS`. Each entry plus rationale:

### `/fetch.*deno\.land/i`
- **Why retry:** The phrase only appears in Deno's import-resolution error path when fetching a remote module from `deno.land`. Always a transport failure.
- **False-positive risk:** A TS source file with `// fetch from deno.land` in a comment that ends up in a stack trace. Guarded by fail-fast precedence (any `TypeError`/`SyntaxError`/`AssertionError` in the same output beats this).
- **Fixture:** `error: error sending request for url (https://deno.land/std@0.x/x.ts)`

### `/deno\.land.*\b5\d{2}\b/i`
- **Why retry:** HTTP 5xx is by definition a transient server-side failure.
- **False-positive risk:** An assertion-value diff that contains the literal string `"5xx"` near the word `"deno.land"`. Guarded by fail-fast (`AssertionError:` / `Expected:…Received:` beats this).
- **Fixture:** `deno.land returned 502 Bad Gateway`

### `/\b(ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|ECONNREFUSED)\b/`
- **Why retry:** Kernel-level transient socket errors from libuv / Deno's reqwest. Word-boundary anchored so `MyECONNRESETError` (a custom error class) doesn't match.
- **False-positive risk:** A vitest assertion that asserts on a socket-code string literal. Guarded by fail-fast.
- **Fixture:** `Error: connect ECONNRESET 1.2.3.4:443`

### `/error sending request/i`
- **Why retry:** Phrase only emitted by Deno/reqwest when the underlying transport (DNS / socket / TLS) failed.
- **False-positive risk:** Low — phrase is not a typical app-error idiom.
- **Fixture:** `error: error sending request for url`

### `/connection (closed|reset) before message completed/i`
- **Why retry:** HTTP/2 / chunked-transfer mid-flight reset. Only the HTTP client emits this.
- **False-positive risk:** Low — phrase is HTTP-stack specific.
- **Fixture:** `connection closed before message completed`

### `/tcp connect error/i`
- **Why retry:** Reqwest/hyper TCP-handshake failure. Network-stack specific phrase.
- **False-positive risk:** Low.
- **Fixture:** `tcp connect error: connection refused`

## Fail-fast precedence — what NEVER retries

Defined as `FAIL_FAST_PATTERNS` in the same script. If ANY of these appear in the failed command's output, the wrapper exits immediately with the original code, even if a transient pattern also matched. **Real bugs always win over transient-shaped substrings inside their own diff/stack traces.**

| Pattern | What it catches |
|---|---|
| `/\berror:\s+TypeError\b/` | Deno-style thrown TypeError |
| `/\bTypeError:/` | Bare `TypeError: x is not a function` |
| `/\bAssertionError:/` | vitest / chai / `node:assert` |
| `/\bSyntaxError:/` | Parse-time error |
| `/\bReferenceError:/` | Bare reference error |
| `/\bTS\d{4}:/` | tsc diagnostic codes (TS2345, TS2322, …) |
| `/\berror\sTS\d{4}\b/i` | tsc CLI form: `error TS2345` |
| `/\b(FAIL\|✗)\b.*\.test\.[tj]sx?/` | vitest failure header |
| `/\bExpected:.*\bReceived:/s` | jest/vitest assertion diff block |

### Rule for adding new transient matchers

If you propose adding a new matcher, the CI smoke check (`check:retry-wrapper`) will run automatically on PR — but you must also reason about overlap with `FAIL_FAST_PATTERNS`. If your new pattern would match output that *also* contains any fail-fast indicator, fail-fast wins. That's intentional: a real bug is never a network problem.

If you find yourself wanting a transient matcher that is so generic it would shadow real errors, **don't add it**. Tighten the upstream tool's error reporting instead.

## Escalation path — when retries become noise

Retries are silent on success. Each retry attempt prints to stderr:

```
[run-with-retry] transient failure detected (attempt N/3); retrying in Xms...
```

Watch CI logs for the frequency of these lines.

### Healthy baseline

- 0 retries on most CI runs
- Occasional single retry (1/N runs) during a real deno.land hiccup
- All retries eventually succeed (no `attempt 3/3` failures)

### Warning signs

| Signal | What it means | Action |
|---|---|---|
| **Same script needs 2+ retries on every CI run** | Not a transient — there's a real flake somewhere. The wrapper is masking it. | Investigate the underlying script. Check if the deno.land dependency has been deprecated/moved. Consider vendoring (Option B from the original `run-with-retry` ship). |
| **`attempt 3/3` failures recurring across multiple runs** | Sustained outage at the upstream provider. | Pause CI gating temporarily. Check provider status page. If the outage exceeds 1 hour, switch the wrapped step to a vendored alternative until provider recovers. |
| **A new error string starts triggering retries that look unrelated to network** | The transient matcher set has overreached. A new tool's error format happens to match a regex. | Tighten the offending regex. Add a `FAIL_FAST_PATTERNS` entry that recognises the new tool's failure shape. Add a vitest case that asserts the false-positive does NOT retry. |
| **`run-with-retry` adds >30s to CI runtime as a steady state** | Backoffs are too long for the actual flake rate. | Tune `--backoff=` arguments down. Default is 5s/15s/45s; the smoke check uses 50ms/50ms for verification only. |

### Investigation steps

1. **Confirm the failure shape.** Check the failing CI run's full output. Find the offending stderr line. Is it genuinely a network error, or is it a real bug whose output happens to contain a transient-shaped substring?
2. **If real bug:** Add a `FAIL_FAST_PATTERNS` entry that recognises this bug shape. Add a vitest case in `src/__tests__/run-with-retry.test.ts` to lock it.
3. **If genuine transient:** Check provider status page. If the outage is sustained, escalate to a maintainer to pause the affected verify step temporarily.
4. **If neither:** The matcher set has drifted. Audit `TRANSIENT_PATTERNS` for the regex that's matching too broadly and tighten it. Run the smoke check (`npm run check:retry-wrapper`) to confirm the wrapper still behaves correctly after the change.

## Audit trail — why this wrapper exists

**Motivating incident — Rooms Ship E (2026-05-09):** The `check:edge` step failed during an otherwise-clean verify run. The failure was a `fetch deno.land` 500 in `admin-stats`'s typecheck dependency. Re-running CI passed without code changes. This was the third such transient failure across two weeks, all on the same step, all caused by deno.land 5xx responses.

The choice at the time was:

- **Option A (chosen):** Wrap the offending step with a generic retry helper, narrow matcher set, fail-fast precedence on real bugs.
- **Option B:** Vendor the deno.land dependencies into the repo (`deno vendor`) so CI never fetches from deno.land at runtime.

Option A was chosen because it's a smaller blast radius (~60 LOC, leaves `check-edge-functions.mjs` untouched), degrades gracefully on every run, and doesn't have the chicken-and-egg problem Option B introduces (a fresh CI clone with deno.land down would still fail). The trade-off accepted: retries hide slow-but-eventually-passing CI. The escalation criteria above is the explicit guard against that becoming invisible.

If retries start causing problems that the escalation steps can't address, Option B is the next step. Vendoring would add MB-scale `vendor/` to repo clone + a bootstrap step + cache-invalidation rules, but would eliminate the deno.land dependency entirely.

## Related files

- `scripts/run-with-retry.mjs` — the wrapper implementation
- `src/__tests__/run-with-retry.test.ts` — unit-level tests (mocked runner, 11 cases)
- `scripts/__fixtures__/retry-smoke-cmd.mjs` — deterministic smoke fixture (3-attempt sequence)
- `scripts/check-retry-wrapper-smoke.mjs` — integration smoke check, wired into `verify`
- `docs/release/v1-v2-fk-drift-2026-04-30.md` — historical context (run-with-retry ship + hardening pass)
