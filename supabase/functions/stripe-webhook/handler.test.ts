/**
 * Unit tests for the Stripe webhook handler. Run with:
 *
 *   deno test supabase/functions/stripe-webhook/handler.test.ts --allow-env
 *
 * Zero external imports — uses inline assertion helpers so the test file is
 * independent of any network fetch. handler.ts itself has no top-level
 * esm.sh imports either, so Deno can type-check it offline.
 */
import {
  handleStripeWebhook,
  syncSubscriptionByEmail,
  upsertSubscription,
  type StripeEvent,
  type StripeLike,
  type StripeCustomer,
  type StripeSubscription,
  type SupabaseAdminLike,
} from "./handler.ts";

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) {
    throw new Error(msg ?? `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Silence the handler's console.log/warn/error noise during tests.
function quietConsole() {
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  return () => {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  };
}

// ── Fake Supabase admin ─────────────────────────────────────────────

interface FakeCall {
  table: string;
  op: "select" | "upsert";
  filters: Record<string, unknown>;
  payload?: unknown;
  onConflict?: string;
  terminal: "maybeSingle" | "await";
}

interface FakeResult {
  data?: unknown;
  error?: { message: string } | null;
}

type SupabaseHandler = (call: FakeCall) => FakeResult;

interface FakeListUsersArgs { page: number; perPage: number }

function makeFakeSupabase(
  dbHandler: SupabaseHandler,
  listUsersHandler: (args: FakeListUsersArgs) => { users?: Array<{ id: string; email?: string | null }>; error?: { message: string } | null } = () => ({ users: [] }),
): { client: SupabaseAdminLike; calls: FakeCall[]; listUsersCalls: FakeListUsersArgs[] } {
  const calls: FakeCall[] = [];
  const listUsersCalls: FakeListUsersArgs[] = [];

  const client: SupabaseAdminLike = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      let payload: unknown;
      let onConflict: string | undefined;

      const finish = (op: FakeCall["op"], terminal: FakeCall["terminal"]) => {
        const call: FakeCall = { table, op, filters: { ...filters }, payload, onConflict, terminal };
        calls.push(call);
        return Promise.resolve(dbHandler(call));
      };

      const builder = {
        select() { return builder; },
        eq(key: string, val: unknown) { filters[key] = val; return builder; },
        limit() { return builder; },
        maybeSingle() { return finish("select", "maybeSingle"); },
        then(resolve: (v: FakeResult) => unknown) {
          return finish("select", "await").then(resolve);
        },
        upsert(p: unknown, opts?: { onConflict?: string }) {
          payload = p;
          onConflict = opts?.onConflict;
          return {
            then(resolve: (v: FakeResult) => unknown) {
              return finish("upsert", "await").then(resolve);
            },
          };
        },
      };

      return builder;
    },
    auth: {
      admin: {
        listUsers: async (args) => {
          listUsersCalls.push(args);
          const result = listUsersHandler(args);
          return {
            data: { users: result.users ?? [] },
            error: result.error ?? null,
          };
        },
      },
    },
  };

  return { client, calls, listUsersCalls };
}

// ── Fake Stripe ─────────────────────────────────────────────────────

interface FakeStripeState {
  constructEventAsync?: (body: string, signature: string, secret: string) => Promise<StripeEvent>;
  customers?: {
    list?: (params: { email: string; limit: number }) => Promise<{ data: StripeCustomer[] }>;
    retrieve?: (id: string) => Promise<StripeCustomer>;
  };
  subscriptions?: {
    list?: (params: { customer: string; limit: number }) => Promise<{ data: StripeSubscription[] }>;
  };
}

function makeFakeStripe(state: FakeStripeState = {}): StripeLike {
  return {
    webhooks: {
      constructEventAsync: state.constructEventAsync ?? (async () => {
        throw new Error("constructEventAsync not stubbed");
      }),
    },
    customers: {
      list: state.customers?.list ?? (async () => ({ data: [] })),
      retrieve: state.customers?.retrieve ?? (async () => ({ id: "cus_default" })),
    },
    subscriptions: {
      list: state.subscriptions?.list ?? (async () => ({ data: [] })),
    },
  };
}

const deps = (opts: Partial<{ stripe: StripeLike; supabase: SupabaseAdminLike; webhookSecret: string }>) => ({
  stripe: opts.stripe ?? makeFakeStripe(),
  supabase: opts.supabase ?? makeFakeSupabase(() => ({ data: null, error: null })).client,
  webhookSecret: opts.webhookSecret ?? "whsec_test",
});

function jsonRequest(body: string, headers: Record<string, string> = {}, method = "POST") {
  return new Request("https://fn.test/webhook", {
    method,
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

// ── handleStripeWebhook — top-level routing ─────────────────────────

Deno.test("rejects non-POST with 405", async () => {
  const restore = quietConsole();
  try {
    const req = new Request("https://fn.test/", { method: "GET" });
    const res = await handleStripeWebhook(req, deps({}));
    assertEquals(res.status, 405);
  } finally { restore(); }
});

Deno.test("rejects missing stripe-signature header with 400", async () => {
  const restore = quietConsole();
  try {
    const req = jsonRequest("{}");
    const res = await handleStripeWebhook(req, deps({}));
    assertEquals(res.status, 400);
    const text = await res.text();
    assertEquals(text, "Missing signature");
  } finally { restore(); }
});

Deno.test("rejects when signature verification fails", async () => {
  const restore = quietConsole();
  try {
    const stripe = makeFakeStripe({
      constructEventAsync: async () => { throw new Error("bad signature"); },
    });
    const req = jsonRequest("{}", { "stripe-signature": "sig" });
    const res = await handleStripeWebhook(req, deps({ stripe }));
    assertEquals(res.status, 400);
    const text = await res.text();
    assert(text.includes("bad signature"));
  } finally { restore(); }
});

Deno.test("returns 200 + { received: true } for a valid unhandled event type", async () => {
  const restore = quietConsole();
  try {
    const stripe = makeFakeStripe({
      constructEventAsync: async () => ({ type: "some.random.event", id: "evt_1", data: { object: {} } }),
    });
    const req = jsonRequest("{}", { "stripe-signature": "sig" });
    const res = await handleStripeWebhook(req, deps({ stripe }));
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("Content-Type"), "application/json");
    const body = await res.json();
    assertEquals(body.received, true);
  } finally { restore(); }
});

Deno.test("returns 500 when the handler hits an unexpected error before the switch", async () => {
  const restore = quietConsole();
  try {
    // req.text() throwing triggers the outer catch.
    const req = {
      method: "POST",
      headers: { get: () => "sig" },
      text: async () => { throw new Error("boom"); },
    } as unknown as Request;
    const res = await handleStripeWebhook(req, deps({}));
    assertEquals(res.status, 500);
    const body = await res.json();
    assertEquals(body.error, "Internal server error");
  } finally { restore(); }
});

// ── handleStripeWebhook — routing by event.type ─────────────────────

Deno.test("checkout.session.completed in subscription mode triggers sync", async () => {
  const restore = quietConsole();
  try {
    let syncEmail: string | undefined;
    const stripe = makeFakeStripe({
      constructEventAsync: async () => ({
        type: "checkout.session.completed",
        id: "evt_1",
        data: { object: { mode: "subscription", customer_email: "user@example.com" } },
      }),
      // The sync path calls stripe.customers.list; track to confirm we reached it.
      customers: {
        list: async ({ email }) => {
          syncEmail = email;
          return { data: [] }; // no Stripe customer → sync aborts at 3rd fallback
        },
      },
    });
    const { client } = makeFakeSupabase(() => ({ data: null, error: null }));
    const req = jsonRequest("{}", { "stripe-signature": "sig" });
    await handleStripeWebhook(req, deps({ stripe, supabase: client }));
    assertEquals(syncEmail, "user@example.com");
  } finally { restore(); }
});

Deno.test("checkout.session.completed in non-subscription mode is a no-op", async () => {
  const restore = quietConsole();
  try {
    let listCalled = false;
    const stripe = makeFakeStripe({
      constructEventAsync: async () => ({
        type: "checkout.session.completed",
        id: "evt_1",
        data: { object: { mode: "payment", customer_email: "user@example.com" } },
      }),
      customers: {
        list: async () => { listCalled = true; return { data: [] }; },
      },
    });
    await handleStripeWebhook(jsonRequest("{}", { "stripe-signature": "sig" }), deps({ stripe }));
    assertEquals(listCalled, false);
  } finally { restore(); }
});

Deno.test("customer.subscription.updated resolves customer email before sync", async () => {
  const restore = quietConsole();
  try {
    let retrievedCustomerId: string | undefined;
    let syncEmail: string | undefined;
    const stripe = makeFakeStripe({
      constructEventAsync: async () => ({
        type: "customer.subscription.updated",
        id: "evt_1",
        data: { object: { customer: "cus_123" } },
      }),
      customers: {
        retrieve: async (id: string) => {
          retrievedCustomerId = id;
          return { id, email: "owner@example.com" };
        },
        list: async ({ email }) => { syncEmail = email; return { data: [] }; },
      },
    });
    await handleStripeWebhook(jsonRequest("{}", { "stripe-signature": "sig" }), deps({ stripe }));
    assertEquals(retrievedCustomerId, "cus_123");
    assertEquals(syncEmail, "owner@example.com");
  } finally { restore(); }
});

Deno.test("customer.subscription.deleted routes through the same sync path", async () => {
  const restore = quietConsole();
  try {
    let syncEmail: string | undefined;
    const stripe = makeFakeStripe({
      constructEventAsync: async () => ({
        type: "customer.subscription.deleted",
        id: "evt_1",
        data: { object: { customer: "cus_456" } },
      }),
      customers: {
        retrieve: async () => ({ id: "cus_456", email: "deleted@example.com" }),
        list: async ({ email }) => { syncEmail = email; return { data: [] }; },
      },
    });
    await handleStripeWebhook(jsonRequest("{}", { "stripe-signature": "sig" }), deps({ stripe }));
    assertEquals(syncEmail, "deleted@example.com");
  } finally { restore(); }
});

Deno.test("subscription events skip sync for deleted Stripe customers", async () => {
  const restore = quietConsole();
  try {
    let syncCalled = false;
    const stripe = makeFakeStripe({
      constructEventAsync: async () => ({
        type: "customer.subscription.updated",
        id: "evt_1",
        data: { object: { customer: "cus_999" } },
      }),
      customers: {
        retrieve: async () => ({ id: "cus_999", deleted: true }),
        list: async () => { syncCalled = true; return { data: [] }; },
      },
    });
    await handleStripeWebhook(jsonRequest("{}", { "stripe-signature": "sig" }), deps({ stripe }));
    assertEquals(syncCalled, false);
  } finally { restore(); }
});

Deno.test("invoice.payment_failed forwards 'payment_failed' as the override status", async () => {
  const restore = quietConsole();
  try {
    // Track the supabase upsert payload to confirm the override propagated.
    const { client, calls } = makeFakeSupabase(
      (call) => {
        if (call.op === "select" && call.table === "subscriptions") {
          return { data: { user_id: "user-1" }, error: null };
        }
        if (call.op === "upsert") return { error: null };
        return { data: null, error: null };
      },
    );
    const stripe = makeFakeStripe({
      constructEventAsync: async () => ({
        type: "invoice.payment_failed",
        id: "evt_1",
        data: { object: { customer: "cus_111" } },
      }),
      customers: {
        retrieve: async () => ({ id: "cus_111", email: "late@example.com" }),
        list: async () => ({ data: [{ id: "cus_111", email: "late@example.com" }] }),
      },
      subscriptions: {
        list: async () => ({ data: [] }),
      },
    });
    await handleStripeWebhook(jsonRequest("{}", { "stripe-signature": "sig" }), deps({ stripe, supabase: client }));
    const upsertCall = calls.find((c) => c.op === "upsert");
    assert(upsertCall);
    const payload = upsertCall!.payload as { status: string };
    assertEquals(payload.status, "payment_failed");
  } finally { restore(); }
});

// ── syncSubscriptionByEmail ─────────────────────────────────────────

Deno.test("sync — resolves via existing subscriptions row (fast path) and upserts", async () => {
  const restore = quietConsole();
  try {
    const { client, calls } = makeFakeSupabase((call) => {
      if (call.op === "select" && call.table === "subscriptions") {
        // The subscription row exists → first lookup wins.
        return { data: { user_id: "user-A" }, error: null };
      }
      if (call.op === "upsert") return { error: null };
      return { data: null, error: null };
    });
    const stripe = makeFakeStripe({
      customers: { list: async () => ({ data: [{ id: "cus_A", email: "a@example.com" }] }) },
      subscriptions: { list: async () => ({ data: [] }) },
    });
    await syncSubscriptionByEmail(stripe, client, "a@example.com");
    // No profiles or listUsers fallback calls.
    const profilesLookup = calls.some((c) => c.table === "profiles");
    assertEquals(profilesLookup, false);
    const upsertCall = calls.find((c) => c.op === "upsert");
    assert(upsertCall);
    const payload = upsertCall!.payload as { user_id: string; stripe_customer_id: string };
    assertEquals(payload.user_id, "user-A");
    assertEquals(payload.stripe_customer_id, "cus_A");
  } finally { restore(); }
});

Deno.test("sync — falls back to profiles lookup when subscriptions row is missing", async () => {
  const restore = quietConsole();
  try {
    const { client, calls } = makeFakeSupabase((call) => {
      if (call.op === "select" && call.table === "subscriptions") return { data: null, error: null };
      if (call.op === "select" && call.table === "profiles") {
        return { data: [{ user_id: "user-B" }], error: null };
      }
      if (call.op === "upsert") return { error: null };
      return { data: null, error: null };
    });
    const stripe = makeFakeStripe({
      customers: { list: async () => ({ data: [{ id: "cus_B", email: "b@example.com" }] }) },
    });
    await syncSubscriptionByEmail(stripe, client, "b@example.com");
    const upsert = calls.find((c) => c.op === "upsert")!;
    assertEquals((upsert.payload as { user_id: string }).user_id, "user-B");
  } finally { restore(); }
});

Deno.test("sync — paginates auth.users as the last-resort fallback", async () => {
  const restore = quietConsole();
  try {
    const { client, calls } = makeFakeSupabase(
      (call) => {
        if (call.op === "select" && call.table === "subscriptions") return { data: null, error: null };
        if (call.op === "select" && call.table === "profiles") return { data: [], error: null };
        if (call.op === "upsert") return { error: null };
        return { data: null, error: null };
      },
      (args) => {
        // Page 1: 1000 dummy users (not our email) — forces continuation
        // Page 2: our user → hit
        if (args.page === 1) {
          const users = Array.from({ length: 1000 }, (_, i) => ({ id: `u${i}`, email: `other${i}@example.com` }));
          return { users };
        }
        if (args.page === 2) {
          return { users: [{ id: "user-C", email: "c@example.com" }] };
        }
        return { users: [] };
      },
    );
    const stripe = makeFakeStripe({
      customers: { list: async () => ({ data: [{ id: "cus_C", email: "c@example.com" }] }) },
    });
    await syncSubscriptionByEmail(stripe, client, "c@example.com");
    const upsert = calls.find((c) => c.op === "upsert");
    assert(upsert);
    assertEquals((upsert!.payload as { user_id: string }).user_id, "user-C");
  } finally { restore(); }
});

Deno.test("sync — stops pagination early when a page returns < PAGE_SIZE users (no match)", async () => {
  const restore = quietConsole();
  try {
    let pagesRequested = 0;
    const { client, listUsersCalls } = makeFakeSupabase(
      (call) => {
        if (call.op === "select" && call.table === "subscriptions") return { data: null, error: null };
        if (call.op === "select" && call.table === "profiles") return { data: [], error: null };
        return { data: null, error: null };
      },
      () => {
        pagesRequested++;
        // Return 10 users — smaller than PAGE_SIZE (1000) → loop must stop.
        return { users: [{ id: "x", email: "other@example.com" }] };
      },
    );
    const stripe = makeFakeStripe({ customers: { list: async () => ({ data: [] }) } });
    await syncSubscriptionByEmail(stripe, client, "notfound@example.com");
    assertEquals(listUsersCalls.length, 1);
    assertEquals(pagesRequested, 1);
  } finally { restore(); }
});

Deno.test("sync — aborts silently when no user is found across any path", async () => {
  const restore = quietConsole();
  try {
    const { client, calls } = makeFakeSupabase(
      (call) => {
        if (call.op === "select") return { data: null, error: null };
        if (call.op === "upsert") return { error: null };
        return { data: null, error: null };
      },
      () => ({ users: [] }),
    );
    const stripe = makeFakeStripe({ customers: { list: async () => ({ data: [] }) } });
    await syncSubscriptionByEmail(stripe, client, "ghost@example.com");
    // No upsert should have run.
    const upsert = calls.find((c) => c.op === "upsert");
    assertEquals(upsert, undefined);
  } finally { restore(); }
});

Deno.test("sync — catches a Stripe error in the fast-path and still runs the profiles fallback", async () => {
  const restore = quietConsole();
  try {
    const { client, calls } = makeFakeSupabase((call) => {
      if (call.op === "select" && call.table === "profiles") {
        return { data: [{ user_id: "user-D" }], error: null };
      }
      if (call.op === "upsert") return { error: null };
      return { data: null, error: null };
    });
    // Step 1 throws, but step 2 (profiles) still runs. Upstream, upsert then
    // calls stripe.customers.list a second time — which will also throw, so
    // the overall promise rejects. We only care here that the fallback did run.
    let firstCall = true;
    const stripe = makeFakeStripe({
      customers: {
        list: async () => {
          if (firstCall) { firstCall = false; throw new Error("stripe timeout"); }
          // Let the second call (inside upsertSubscription) succeed with no customer,
          // so upsert returns early with no error.
          return { data: [] };
        },
      },
    });
    await syncSubscriptionByEmail(stripe, client, "d@example.com");
    const profilesLookup = calls.find((c) => c.table === "profiles");
    assert(profilesLookup);
  } finally { restore(); }
});

// ── upsertSubscription ──────────────────────────────────────────────

Deno.test("upsert — writes Stripe fields + applies onConflict: user_id", async () => {
  const restore = quietConsole();
  try {
    const { client, calls } = makeFakeSupabase((call) => {
      if (call.op === "upsert") return { error: null };
      return { data: null, error: null };
    });
    const stripe = makeFakeStripe({
      customers: { list: async () => ({ data: [{ id: "cus_E", email: "e@example.com" }] }) },
      subscriptions: {
        list: async () => ({
          data: [{
            id: "sub_1",
            customer: "cus_E",
            status: "active",
            current_period_end: 1_750_000_000,
            items: { data: [{ price: { id: "price_1", product: "prod_1" } }] },
          }],
        }),
      },
    });
    await upsertSubscription(stripe, client, "user-E", "e@example.com");
    const upsert = calls.find((c) => c.op === "upsert");
    assert(upsert);
    const payload = upsert!.payload as Record<string, unknown>;
    assertEquals(payload.user_id, "user-E");
    assertEquals(payload.stripe_customer_id, "cus_E");
    assertEquals(payload.stripe_subscription_id, "sub_1");
    assertEquals(payload.status, "active");
    assertEquals(payload.product_id, "prod_1");
    assertEquals(payload.price_id, "price_1");
    assertEquals(upsert!.onConflict, "user_id");
  } finally { restore(); }
});

Deno.test("upsert — returns early when Stripe has no matching customer", async () => {
  const restore = quietConsole();
  try {
    const { client, calls } = makeFakeSupabase(() => ({ data: null, error: null }));
    const stripe = makeFakeStripe({ customers: { list: async () => ({ data: [] }) } });
    await upsertSubscription(stripe, client, "user-X", "x@example.com");
    // No upsert should have run.
    assertEquals(calls.length, 0);
  } finally { restore(); }
});

Deno.test("upsert — writes 'inactive' status when Stripe has no subscription row", async () => {
  const restore = quietConsole();
  try {
    const { client, calls } = makeFakeSupabase(() => ({ error: null }));
    const stripe = makeFakeStripe({
      customers: { list: async () => ({ data: [{ id: "cus_F", email: "f@example.com" }] }) },
      subscriptions: { list: async () => ({ data: [] }) },
    });
    await upsertSubscription(stripe, client, "user-F", "f@example.com");
    const upsert = calls.find((c) => c.op === "upsert");
    assert(upsert);
    const payload = upsert!.payload as { status: string; current_period_end: null | string; stripe_subscription_id: null | string };
    assertEquals(payload.status, "inactive");
    assertEquals(payload.current_period_end, null);
    assertEquals(payload.stripe_subscription_id, null);
  } finally { restore(); }
});

Deno.test("upsert — overrideStatus takes precedence over Stripe's sub.status", async () => {
  const restore = quietConsole();
  try {
    const { client, calls } = makeFakeSupabase(() => ({ error: null }));
    const stripe = makeFakeStripe({
      customers: { list: async () => ({ data: [{ id: "cus_G", email: "g@example.com" }] }) },
      subscriptions: {
        list: async () => ({
          data: [{
            id: "sub_G",
            customer: "cus_G",
            status: "active", // Stripe says active…
            current_period_end: 1_750_000_000,
            items: { data: [{ price: { id: "price_1", product: "prod_1" } }] },
          }],
        }),
      },
    });
    // …but the webhook reports payment_failed → override wins.
    await upsertSubscription(stripe, client, "user-G", "g@example.com", "payment_failed");
    const upsert = calls.find((c) => c.op === "upsert")!;
    const payload = upsert.payload as { status: string };
    assertEquals(payload.status, "payment_failed");
  } finally { restore(); }
});

Deno.test("upsert — current_period_end converts from unix seconds to ISO string", async () => {
  const restore = quietConsole();
  try {
    const { client, calls } = makeFakeSupabase(() => ({ error: null }));
    const stripe = makeFakeStripe({
      customers: { list: async () => ({ data: [{ id: "cus_H", email: "h@example.com" }] }) },
      subscriptions: {
        list: async () => ({
          data: [{
            id: "sub_H",
            customer: "cus_H",
            status: "active",
            current_period_end: 1_700_000_000, // 2023-11-14T22:13:20Z
            items: { data: [{ price: { id: "price_1", product: "prod_1" } }] },
          }],
        }),
      },
    });
    await upsertSubscription(stripe, client, "user-H", "h@example.com");
    const upsert = calls.find((c) => c.op === "upsert")!;
    const payload = upsert.payload as { current_period_end: string };
    assertEquals(payload.current_period_end, "2023-11-14T22:13:20.000Z");
  } finally { restore(); }
});

Deno.test("upsert — handles expanded price.product (Product object, not just id)", async () => {
  const restore = quietConsole();
  try {
    const { client, calls } = makeFakeSupabase(() => ({ error: null }));
    const stripe = makeFakeStripe({
      customers: { list: async () => ({ data: [{ id: "cus_I", email: "i@example.com" }] }) },
      subscriptions: {
        list: async () => ({
          data: [{
            id: "sub_I",
            customer: "cus_I",
            status: "trialing",
            current_period_end: 1_750_000_000,
            items: { data: [{ price: { id: "price_2", product: { id: "prod_expanded" } } }] },
          }],
        }),
      },
    });
    await upsertSubscription(stripe, client, "user-I", "i@example.com");
    const upsert = calls.find((c) => c.op === "upsert")!;
    const payload = upsert.payload as { product_id: string };
    assertEquals(payload.product_id, "prod_expanded");
  } finally { restore(); }
});
