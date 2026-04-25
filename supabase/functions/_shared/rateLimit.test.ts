/**
 * Unit tests for the rate limiter. Run with:
 *
 *   deno test supabase/functions/_shared/rateLimit.test.ts --allow-env
 *
 * Uses a tiny fake supabase client (injected via the `supabase` option) so the
 * real client is never constructed — avoids any esm.sh / network dependency
 * in the test path.
 */
import { checkRateLimit, rateLimitResponse, type RateLimitSupabaseLike } from "./rateLimit.ts";

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) {
    throw new Error(msg ?? `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ── Fake supabase builder ────────────────────────────────────────────

interface FakeCall {
  table: string;
  op: "select" | "insert";
  filters: Record<string, unknown>;
  payload?: unknown;
}

interface FakeCountReply {
  count?: number;
  error?: { message: string } | null;
}

type SelectReplyFn = (call: FakeCall) => FakeCountReply;

function makeFakeSupabase(
  selectHandler: SelectReplyFn,
): { client: RateLimitSupabaseLike; calls: FakeCall[] } {
  const calls: FakeCall[] = [];

  const client: RateLimitSupabaseLike = {
    from(table: string) {
      return {
        select(_cols: string, _opts?: { count?: string; head?: boolean }) {
          const filters: Record<string, unknown> = {};
          const builder = {
            eq(key: string, val: unknown) {
              filters[key] = val;
              return builder;
            },
            gte(key: string, val: unknown) {
              filters[key] = val;
              return builder;
            },
            then(resolve: (v: FakeCountReply) => unknown) {
              const call: FakeCall = { table, op: "select", filters };
              calls.push(call);
              return Promise.resolve(selectHandler(call)).then(resolve);
            },
          };
          return builder;
        },
        insert(payload: unknown) {
          const call: FakeCall = { table, op: "insert", filters: {}, payload };
          calls.push(call);
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  return { client, calls };
}

// ── rateLimitResponse ────────────────────────────────────────────────

Deno.test("rateLimitResponse — returns 429 JSON with remaining + resetAt", async () => {
  const res = rateLimitResponse({ "Access-Control-Allow-Origin": "*" }, 0, "2026-04-23T00:00:00Z");
  assertEquals(res.status, 429);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  const body = await res.json();
  assertEquals(body.error, "Rate limit exceeded");
  assertEquals(body.remaining, 0);
  assertEquals(body.resetAt, "2026-04-23T00:00:00Z");
});

// ── checkRateLimit ───────────────────────────────────────────────────

Deno.test("checkRateLimit — allows when usage is below the per-user cap and records the request", async () => {
  const { client, calls } = makeFakeSupabase(() => ({ count: 5, error: null }));
  const result = await checkRateLimit("user-1", "ai-fn", 20, 60, { supabase: client });
  assertEquals(result.allowed, true);
  assertEquals(result.remaining, 14); // 20 - 5 - 1 (this request)
  // We expect: one select on rate_limits + one insert to record this request.
  assertEquals(calls.length, 2);
  assertEquals(calls[0].op, "select");
  assertEquals(calls[0].table, "rate_limits");
  assertEquals(calls[0].filters.user_id, "user-1");
  assertEquals(calls[0].filters.function_name, "ai-fn");
  assertEquals(calls[1].op, "insert");
  assertEquals(calls[1].table, "rate_limits");
});

Deno.test("checkRateLimit — denies and does NOT insert when the per-user cap is hit", async () => {
  const { client, calls } = makeFakeSupabase(() => ({ count: 20, error: null }));
  const result = await checkRateLimit("user-1", "ai-fn", 20, 60, { supabase: client });
  assertEquals(result.allowed, false);
  assertEquals(result.remaining, 0);
  assert(typeof result.resetAt === "string" && result.resetAt.length > 0);
  // Only the select — the insert path must be skipped when denied.
  assertEquals(calls.length, 1);
  assertEquals(calls[0].op, "select");
});

Deno.test("checkRateLimit — boundary: used === maxRequests denies", async () => {
  const { client } = makeFakeSupabase(() => ({ count: 20, error: null }));
  const result = await checkRateLimit("user-1", "ai-fn", 20, 60, { supabase: client });
  assertEquals(result.allowed, false);
});

Deno.test("checkRateLimit — boundary: used === maxRequests - 1 allows, remaining 0", async () => {
  const { client } = makeFakeSupabase(() => ({ count: 19, error: null }));
  const result = await checkRateLimit("user-1", "ai-fn", 20, 60, { supabase: client });
  assertEquals(result.allowed, true);
  assertEquals(result.remaining, 0); // Math.max(0, 20 - 19 - 1) = 0
});

Deno.test("checkRateLimit — treats null count as 0 used (fresh user)", async () => {
  const { client } = makeFakeSupabase(() => ({ count: undefined, error: null }));
  const result = await checkRateLimit("new-user", "ai-fn", 5, 60, { supabase: client });
  assertEquals(result.allowed, true);
  assertEquals(result.remaining, 4); // 5 - 0 - 1
});

Deno.test("checkRateLimit — fails closed when the select errors", async () => {
  const { client } = makeFakeSupabase(() => ({ error: { message: "db unavailable" } }));
  const result = await checkRateLimit("user-1", "ai-fn", 20, 60, { supabase: client });
  assertEquals(result.allowed, false);
  assertEquals(result.remaining, 0);
});

Deno.test("checkRateLimit — org check runs when orgId is provided and enforces orgMax", async () => {
  // Per-user = 5 (under cap), per-org = 50 (at cap) → deny.
  const selectResults: FakeCountReply[] = [
    { count: 5, error: null }, // first select = per-user
    { count: 50, error: null }, // second select = per-org
  ];
  let i = 0;
  const { client, calls } = makeFakeSupabase(() => selectResults[i++]);
  const result = await checkRateLimit("user-1", "ai-fn", 20, 60, {
    supabase: client,
    orgId: "org-1",
    orgMax: 50,
  });
  assertEquals(result.allowed, false);
  // Two selects (user + org), no insert.
  assertEquals(calls.length, 2);
  assertEquals(calls[1].filters.org_id, "org-1");
  assertEquals(calls[1].filters.function_name, "ai-fn");
});

Deno.test("checkRateLimit — defaults orgMax to 10× maxRequests when not supplied", async () => {
  // maxRequests=10 → default orgMax=100. Per-user=0, per-org=50 → allow.
  const selectResults: FakeCountReply[] = [
    { count: 0, error: null },
    { count: 50, error: null },
  ];
  let i = 0;
  const { client, calls } = makeFakeSupabase(() => selectResults[i++]);
  const result = await checkRateLimit("user-1", "ai-fn", 10, 60, {
    supabase: client,
    orgId: "org-1",
  });
  assertEquals(result.allowed, true);
  // Sanity: insert recorded with org_id.
  const insertCall = calls.find((c) => c.op === "insert")!;
  assertEquals((insertCall.payload as { org_id?: string }).org_id, "org-1");
});

Deno.test("checkRateLimit — skips org check entirely when orgId is undefined", async () => {
  const { client, calls } = makeFakeSupabase(() => ({ count: 1, error: null }));
  await checkRateLimit("user-1", "ai-fn", 20, 60, { supabase: client });
  // No org_id filter on any select — only user-id filter.
  const selectCalls = calls.filter((c) => c.op === "select");
  assertEquals(selectCalls.length, 1);
  assertEquals(selectCalls[0].filters.org_id, undefined);
});

Deno.test("checkRateLimit — skips org check when orgId is explicitly null", async () => {
  const { client, calls } = makeFakeSupabase(() => ({ count: 1, error: null }));
  await checkRateLimit("user-1", "ai-fn", 20, 60, { supabase: client, orgId: null });
  const selectCalls = calls.filter((c) => c.op === "select");
  assertEquals(selectCalls.length, 1);
});

Deno.test("checkRateLimit — insert payload carries user_id, function_name, and null org_id when no org supplied", async () => {
  const { client, calls } = makeFakeSupabase(() => ({ count: 1, error: null }));
  await checkRateLimit("user-1", "ai-fn", 20, 60, { supabase: client });
  const insertCall = calls.find((c) => c.op === "insert")!;
  const payload = insertCall.payload as { user_id: string; function_name: string; org_id: string | null };
  assertEquals(payload.user_id, "user-1");
  assertEquals(payload.function_name, "ai-fn");
  assertEquals(payload.org_id, null);
});

Deno.test("checkRateLimit — fails closed when the org-level select errors", async () => {
  const selectResults: FakeCountReply[] = [
    { count: 1, error: null },
    { error: { message: "org table unavailable" } },
  ];
  let i = 0;
  const { client } = makeFakeSupabase(() => selectResults[i++]);
  const result = await checkRateLimit("user-1", "ai-fn", 20, 60, { supabase: client, orgId: "org-1" });
  assertEquals(result.allowed, false);
  assertEquals(result.remaining, 0);
});

Deno.test("checkRateLimit — applies windowMinutes to the created_at filter", async () => {
  const { client, calls } = makeFakeSupabase(() => ({ count: 0, error: null }));
  const before = Date.now();
  await checkRateLimit("user-1", "ai-fn", 20, 30, { supabase: client });
  const after = Date.now();
  const gteFilter = calls[0].filters.created_at as string;
  const filterTime = new Date(gteFilter).getTime();
  // Should be roughly 30 minutes before "now" at call time.
  const expectedMin = before - 30 * 60 * 1000;
  const expectedMax = after - 30 * 60 * 1000;
  assert(filterTime >= expectedMin - 100);
  assert(filterTime <= expectedMax + 100);
});

Deno.test("checkRateLimit — catches unexpected exceptions and fails closed", async () => {
  const client: RateLimitSupabaseLike = {
    from() {
      throw new Error("synchronous explosion");
    },
  };
  const result = await checkRateLimit("user-1", "ai-fn", 20, 60, { supabase: client });
  assertEquals(result.allowed, false);
  assertEquals(result.remaining, 0);
});
