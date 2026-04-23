/**
 * Unit tests for create-checkout handler. Run with:
 *
 *   deno test supabase/functions/create-checkout/handler.test.ts --allow-env
 */
import { handleCreateCheckout, type HandleDeps, type StripeLike, type SupabaseLike } from "./handler.ts";

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  const equal = actual === expected || JSON.stringify(actual) === JSON.stringify(expected);
  if (!equal) throw new Error(msg ?? `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function quietConsole() {
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  return () => { console.log = orig.log; console.warn = orig.warn; console.error = orig.error; };
}

const ALLOWED = new Set(["price_basic", "price_pro", "price_enterprise"]);

function okSupabase(email: string | null = "user@example.com"): SupabaseLike {
  return {
    auth: {
      getUser: async () => ({
        data: { user: email ? { email } : null },
        error: null,
      }),
    },
  };
}

function errSupabase(): SupabaseLike {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: { message: "bad token" } }),
    },
  };
}

function makeFakeStripe(opts: {
  customers?: { id: string }[];
  checkoutUrl?: string | null;
  capturedParams?: Record<string, unknown>;
} = {}): StripeLike {
  return {
    customers: {
      list: async () => ({ data: opts.customers ?? [] }),
    },
    checkout: {
      sessions: {
        create: async (params) => {
          if (opts.capturedParams) Object.assign(opts.capturedParams, params);
          return { url: opts.checkoutUrl ?? "https://checkout.stripe.com/session_123" };
        },
      },
    },
  };
}

function makeDeps(overrides: Partial<HandleDeps> = {}): HandleDeps {
  return {
    supabase: okSupabase(),
    stripe: makeFakeStripe(),
    corsHeaders: { "Access-Control-Allow-Origin": "*" },
    isAllowedOrigin: () => false,
    allowedPriceIds: ALLOWED,
    defaultBillingOrigin: "https://tenureiq.com",
    ...overrides,
  };
}

function postRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://fn.test/", {
    method: "POST",
    headers: {
      Authorization: "Bearer user-token",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

// ── Auth + CORS ─────────────────────────────────────────────────────

Deno.test("OPTIONS preflight returns corsHeaders + empty body", async () => {
  const res = await handleCreateCheckout(
    new Request("https://fn.test/", { method: "OPTIONS" }),
    makeDeps(),
  );
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("401 when Authorization header is missing", async () => {
  const res = await handleCreateCheckout(
    new Request("https://fn.test/", { method: "POST", body: "{}" }),
    makeDeps(),
  );
  assertEquals(res.status, 401);
});

Deno.test("401 when Authorization scheme isn't Bearer", async () => {
  const res = await handleCreateCheckout(
    new Request("https://fn.test/", {
      method: "POST",
      headers: { Authorization: "Basic xyz" },
      body: "{}",
    }),
    makeDeps(),
  );
  assertEquals(res.status, 401);
});

Deno.test("401 when supabase.auth.getUser returns an error", async () => {
  const res = await handleCreateCheckout(
    postRequest({ priceId: "price_basic" }),
    makeDeps({ supabase: errSupabase() }),
  );
  assertEquals(res.status, 401);
});

Deno.test("401 when user has no email", async () => {
  const res = await handleCreateCheckout(
    postRequest({ priceId: "price_basic" }),
    makeDeps({
      supabase: {
        auth: { getUser: async () => ({ data: { user: { email: null } }, error: null }) },
      },
    }),
  );
  assertEquals(res.status, 401);
  const body = await res.json();
  assert(String(body.error).includes("email not available"));
});

// ── priceId validation ──────────────────────────────────────────────

Deno.test("400 when body is not valid JSON", async () => {
  const restore = quietConsole();
  try {
    const req = new Request("https://fn.test/", {
      method: "POST",
      headers: { Authorization: "Bearer tok", "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await handleCreateCheckout(req, makeDeps());
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, "Invalid JSON body");
  } finally { restore(); }
});

Deno.test("400 when priceId is missing", async () => {
  const res = await handleCreateCheckout(postRequest({}), makeDeps());
  assertEquals(res.status, 400);
});

Deno.test("400 when priceId is the wrong type", async () => {
  const res = await handleCreateCheckout(postRequest({ priceId: 123 }), makeDeps());
  assertEquals(res.status, 400);
});

Deno.test("400 when priceId doesn't start with 'price_'", async () => {
  const res = await handleCreateCheckout(postRequest({ priceId: "not-a-price" }), makeDeps());
  assertEquals(res.status, 400);
});

Deno.test("400 when priceId is not in the allow-list (even if shaped correctly)", async () => {
  const res = await handleCreateCheckout(postRequest({ priceId: "price_malicious" }), makeDeps());
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "Unsupported priceId");
});

// ── Happy path ──────────────────────────────────────────────────────

Deno.test("reuses an existing Stripe customer when the email matches", async () => {
  const captured: Record<string, unknown> = {};
  const stripe = makeFakeStripe({
    customers: [{ id: "cus_existing" }],
    capturedParams: captured,
  });
  const res = await handleCreateCheckout(postRequest({ priceId: "price_basic" }), makeDeps({ stripe }));
  assertEquals(res.status, 200);
  assertEquals(captured.customer, "cus_existing");
  // customer_email should NOT be set when we have a customer id.
  assertEquals(captured.customer_email, undefined);
});

Deno.test("passes customer_email when no existing customer is found", async () => {
  const captured: Record<string, unknown> = {};
  const stripe = makeFakeStripe({ customers: [], capturedParams: captured });
  const res = await handleCreateCheckout(
    postRequest({ priceId: "price_basic" }),
    makeDeps({ stripe, supabase: okSupabase("new@example.com") }),
  );
  assertEquals(res.status, 200);
  assertEquals(captured.customer, undefined);
  assertEquals(captured.customer_email, "new@example.com");
});

Deno.test("sets line_items with priceId + quantity 1, mode subscription", async () => {
  const captured: Record<string, unknown> = {};
  const stripe = makeFakeStripe({ capturedParams: captured });
  await handleCreateCheckout(
    postRequest({ priceId: "price_pro" }),
    makeDeps({ stripe }),
  );
  assertEquals(captured.line_items, [{ price: "price_pro", quantity: 1 }]);
  assertEquals(captured.mode, "subscription");
});

Deno.test("echoes an allow-listed origin into success/cancel URLs", async () => {
  const captured: Record<string, unknown> = {};
  const stripe = makeFakeStripe({ capturedParams: captured });
  const req = postRequest({ priceId: "price_basic" }, { origin: "https://my-app.example.com" });
  await handleCreateCheckout(req, makeDeps({
    stripe,
    isAllowedOrigin: (o) => o === "https://my-app.example.com",
  }));
  assertEquals(captured.success_url, "https://my-app.example.com/settings?tab=billing&status=success");
  assertEquals(captured.cancel_url, "https://my-app.example.com/settings?tab=billing&status=cancelled");
});

Deno.test("falls back to defaultBillingOrigin for a non-allow-listed origin", async () => {
  const captured: Record<string, unknown> = {};
  const stripe = makeFakeStripe({ capturedParams: captured });
  const req = postRequest({ priceId: "price_basic" }, { origin: "https://evil.example.com" });
  await handleCreateCheckout(req, makeDeps({
    stripe,
    isAllowedOrigin: () => false,
    defaultBillingOrigin: "https://tenureiq.com",
  }));
  assertEquals(captured.success_url, "https://tenureiq.com/settings?tab=billing&status=success");
});

Deno.test("falls back to defaultBillingOrigin when the origin header is missing", async () => {
  const captured: Record<string, unknown> = {};
  const stripe = makeFakeStripe({ capturedParams: captured });
  await handleCreateCheckout(
    postRequest({ priceId: "price_basic" }), // no origin header
    makeDeps({ stripe, defaultBillingOrigin: "https://tenureiq.com" }),
  );
  assertEquals(captured.success_url, "https://tenureiq.com/settings?tab=billing&status=success");
});

Deno.test("returns the Stripe session URL in the response body", async () => {
  const stripe = makeFakeStripe({ checkoutUrl: "https://checkout.stripe.com/c/pay/abc123" });
  const res = await handleCreateCheckout(postRequest({ priceId: "price_basic" }), makeDeps({ stripe }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.url, "https://checkout.stripe.com/c/pay/abc123");
});

// ── Error path ──────────────────────────────────────────────────────

Deno.test("500 with the error message when Stripe throws", async () => {
  const restore = quietConsole();
  try {
    const stripe: StripeLike = {
      customers: { list: async () => { throw new Error("Stripe down"); } },
      checkout: { sessions: { create: async () => ({ url: "x" }) } },
    };
    const res = await handleCreateCheckout(
      postRequest({ priceId: "price_basic" }),
      makeDeps({ stripe }),
    );
    assertEquals(res.status, 500);
    const body = await res.json();
    assertEquals(body.error, "Stripe down");
  } finally { restore(); }
});
