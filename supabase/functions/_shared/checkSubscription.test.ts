/**
 * Unit tests for requireActiveSubscription. Run with:
 *
 *   deno test supabase/functions/_shared/checkSubscription.test.ts --allow-env
 *
 * Uses a fake supabase-admin client injected via the 3rd arg so no real esm.sh
 * import or network call is needed.
 */
import { requireActiveSubscription, type SubscriptionSupabaseLike } from "./checkSubscription.ts";

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) {
    throw new Error(msg ?? `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

interface FakeCall {
  table: string;
  filters: Record<string, unknown>;
  terminal: "maybeSingle" | "await";
}

interface FakeResult {
  data?: unknown;
  error?: { message: string } | null;
}

type Handler = (call: FakeCall) => FakeResult;

function makeFakeSupabase(handler: Handler): {
  client: SubscriptionSupabaseLike;
  calls: FakeCall[];
} {
  const calls: FakeCall[] = [];

  const client: SubscriptionSupabaseLike = {
    from(table: string) {
      const filters: Record<string, unknown> = {};

      const finish = (terminal: FakeCall["terminal"]) => {
        const call: FakeCall = { table, filters: { ...filters }, terminal };
        calls.push(call);
        return Promise.resolve(handler(call));
      };

      const builder = {
        select() { return builder; },
        eq(key: string, val: unknown) { filters[key] = val; return builder; },
        in(key: string, val: unknown) { filters[key] = val; return builder; },
        limit() { return builder; },
        maybeSingle() { return finish("maybeSingle"); },
        then(resolve: (v: FakeResult) => unknown) { return finish("await").then(resolve); },
      };

      return builder;
    },
  };

  return { client, calls };
}

const corsHeaders = { "Access-Control-Allow-Origin": "*" };

Deno.test("allows when the user has their own active subscription", async () => {
  const { client, calls } = makeFakeSupabase((call) => {
    if (call.table === "subscriptions" && call.filters.user_id === "user-1") {
      return { data: { status: "active" }, error: null };
    }
    return { data: null, error: null };
  });
  const result = await requireActiveSubscription("user-1", corsHeaders, client);
  assertEquals(result.allowed, true);
  // Only the first query should have been issued — short-circuits on own sub.
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "subscriptions");
});

Deno.test("allows when the user has a trialing subscription (status: trialing)", async () => {
  const { client } = makeFakeSupabase(() => ({ data: { status: "trialing" }, error: null }));
  const result = await requireActiveSubscription("user-1", corsHeaders, client);
  assertEquals(result.allowed, true);
});

Deno.test("allows a team member whose org has another active subscriber", async () => {
  let phase = 0;
  const { client, calls } = makeFakeSupabase((call) => {
    phase++;
    if (phase === 1 && call.table === "subscriptions") {
      return { data: null, error: null }; // no direct sub
    }
    if (phase === 2 && call.table === "memberships") {
      return { data: [{ org_id: "org-1" }], error: null };
    }
    if (phase === 3 && call.table === "memberships") {
      // peers in the same org
      return { data: [{ user_id: "user-1" }, { user_id: "owner-1" }], error: null };
    }
    if (phase === 4 && call.table === "subscriptions") {
      return { data: { status: "active" }, error: null };
    }
    return { data: null, error: null };
  });
  const result = await requireActiveSubscription("user-1", corsHeaders, client);
  assertEquals(result.allowed, true);
  assertEquals(calls.length, 4);
  // The final subscriptions query filters by the peer list, NOT the original user.
  const peerSubCall = calls[3];
  const filterIds = peerSubCall.filters.user_id as string[];
  assert(Array.isArray(filterIds));
  assertEquals(filterIds.includes("owner-1"), true);
  assertEquals(filterIds.includes("user-1"), false);
});

Deno.test("denies when the user has no sub, no memberships, and returns a 402 response", async () => {
  const { client } = makeFakeSupabase((call) => {
    if (call.table === "subscriptions") return { data: null, error: null };
    if (call.table === "memberships") return { data: [], error: null };
    return { data: null, error: null };
  });
  const result = await requireActiveSubscription("user-1", corsHeaders, client);
  assertEquals(result.allowed, false);
  if (result.allowed) throw new Error("unreachable");
  assertEquals(result.response.status, 402);
  assertEquals(result.response.headers.get("Content-Type"), "application/json");
  assertEquals(result.response.headers.get("Access-Control-Allow-Origin"), "*");
  const body = await result.response.json();
  assertEquals(body.error, "Active subscription required");
});

Deno.test("denies when memberships exist but no peers are on a paying plan", async () => {
  let phase = 0;
  const { client } = makeFakeSupabase((call) => {
    phase++;
    if (phase === 1) return { data: null, error: null }; // no own sub
    if (phase === 2 && call.table === "memberships") {
      return { data: [{ org_id: "org-1" }], error: null };
    }
    if (phase === 3 && call.table === "memberships") {
      return { data: [{ user_id: "user-1" }, { user_id: "peer-1" }], error: null };
    }
    if (phase === 4 && call.table === "subscriptions") {
      return { data: null, error: null };
    }
    return { data: null, error: null };
  });
  const result = await requireActiveSubscription("user-1", corsHeaders, client);
  assertEquals(result.allowed, false);
});

Deno.test("filters out the user's own id when looking up peer subscriptions", async () => {
  let phase = 0;
  const { client, calls } = makeFakeSupabase((call) => {
    phase++;
    if (phase === 1) return { data: null, error: null };
    if (phase === 2) return { data: [{ org_id: "org-1" }], error: null };
    if (phase === 3) {
      return { data: [{ user_id: "user-1" }, { user_id: "user-1" }, { user_id: "peer-1" }], error: null };
    }
    if (phase === 4) return { data: null, error: null };
    return { data: null, error: null };
  });
  await requireActiveSubscription("user-1", corsHeaders, client);
  const peerSubCall = calls[3];
  const filterIds = peerSubCall.filters.user_id as string[];
  // user-1 must be stripped, peer-1 kept, no duplicates.
  assertEquals(filterIds.length, 1);
  assertEquals(filterIds[0], "peer-1");
});

Deno.test("skips the peer lookup when memberships returns an empty array", async () => {
  let phase = 0;
  const { client, calls } = makeFakeSupabase((call) => {
    phase++;
    if (phase === 1) return { data: null, error: null };
    if (phase === 2 && call.table === "memberships") return { data: [], error: null };
    return { data: null, error: null };
  });
  await requireActiveSubscription("user-1", corsHeaders, client);
  // Only two queries: own sub + memberships lookup (no peer lookup possible)
  assertEquals(calls.length, 2);
});

Deno.test("handles null memberships gracefully (defaults to empty list)", async () => {
  let phase = 0;
  const { client, calls } = makeFakeSupabase(() => {
    phase++;
    if (phase === 1) return { data: null, error: null };
    if (phase === 2) return { data: null, error: null };
    return { data: null, error: null };
  });
  const result = await requireActiveSubscription("user-1", corsHeaders, client);
  assertEquals(result.allowed, false);
  assertEquals(calls.length, 2); // no crash, no further lookups
});

Deno.test("skips the peer subscription query when peer list is empty after filtering", async () => {
  let phase = 0;
  const { client, calls } = makeFakeSupabase((call) => {
    phase++;
    if (phase === 1) return { data: null, error: null };
    if (phase === 2) return { data: [{ org_id: "org-1" }], error: null };
    if (phase === 3 && call.table === "memberships") {
      // Only the user themselves — stripped during peer dedup → empty peers
      return { data: [{ user_id: "user-1" }], error: null };
    }
    return { data: null, error: null };
  });
  const result = await requireActiveSubscription("user-1", corsHeaders, client);
  assertEquals(result.allowed, false);
  // 3 queries total: own sub, memberships, peer memberships. No 4th peer-sub query.
  assertEquals(calls.length, 3);
});
