/**
 * Unit tests for customer-portal handler. Run with:
 *
 *   deno test supabase/functions/customer-portal/handler.test.ts --allow-env
 */
import { handleCustomerPortal, type HandleDeps, type StripeLike, type SupabaseLike } from "./handler.ts";

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

function supabaseWithUser(user: { id: string; email?: string | null } | null, error: { message: string } | null = null): SupabaseLike {
  return {
    auth: {
      getUser: async () => ({ data: { user }, error }),
    },
  };
}

interface FakeStripeOptions {
  existingCustomers?: { id: string }[];
  newCustomerId?: string;
  portalUrl?: string | null;
  captured?: {
    customersCreate?: Record<string, unknown>;
    portalCreate?: Record<string, unknown>;
  };
}

function makeFakeStripe(opts: FakeStripeOptions = {}): StripeLike {
  return {
    customers: {
      list: async () => ({ data: opts.existingCustomers ?? [] }),
      create: async (p) => {
        if (opts.captured) opts.captured.customersCreate = p;
        return { id: opts.newCustomerId ?? "cus_new" };
      },
    },
    billingPortal: {
      sessions: {
        create: async (p) => {
          if (opts.captured) opts.captured.portalCreate = p;
          return { url: opts.portalUrl ?? "https://billing.stripe.com/p/session_abc" };
        },
      },
    },
  };
}

function makeDeps(overrides: Partial<HandleDeps> = {}): HandleDeps {
  return {
    supabase: supabaseWithUser({ id: "user-1", email: "user@example.com" }),
    stripe: makeFakeStripe(),
    corsHeaders: { "Access-Control-Allow-Origin": "*" },
    isAllowedOrigin: () => false,
    defaultBillingOrigin: "https://tenureiq.com",
    ...overrides,
  };
}

function postReq(headers: Record<string, string> = {}): Request {
  return new Request("https://fn.test/", {
    method: "POST",
    headers: { Authorization: "Bearer user-token", ...headers },
  });
}

// ── CORS + Auth ─────────────────────────────────────────────────────

Deno.test("OPTIONS returns corsHeaders + null body", async () => {
  const res = await handleCustomerPortal(
    new Request("https://fn.test/", { method: "OPTIONS" }),
    makeDeps(),
  );
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("401 on missing Authorization header", async () => {
  const res = await handleCustomerPortal(
    new Request("https://fn.test/", { method: "POST" }),
    makeDeps(),
  );
  assertEquals(res.status, 401);
});

Deno.test("401 when Authorization scheme isn't Bearer", async () => {
  const res = await handleCustomerPortal(
    new Request("https://fn.test/", { method: "POST", headers: { Authorization: "Basic xyz" } }),
    makeDeps(),
  );
  assertEquals(res.status, 401);
});

Deno.test("401 when supabase.auth.getUser returns an error", async () => {
  const res = await handleCustomerPortal(
    postReq(),
    makeDeps({ supabase: supabaseWithUser(null, { message: "bad" }) }),
  );
  assertEquals(res.status, 401);
});

Deno.test("401 when user has no email", async () => {
  const res = await handleCustomerPortal(
    postReq(),
    makeDeps({ supabase: supabaseWithUser({ id: "u", email: null }) }),
  );
  assertEquals(res.status, 401);
  const body = await res.json();
  assert(String(body.error).includes("email"));
});

// ── Customer creation path ──────────────────────────────────────────

Deno.test("creates a new Stripe customer when none exists, with supabase_uid metadata", async () => {
  const captured = {} as NonNullable<FakeStripeOptions["captured"]>;
  const stripe = makeFakeStripe({ existingCustomers: [], newCustomerId: "cus_fresh", captured });
  const res = await handleCustomerPortal(
    postReq(),
    makeDeps({
      stripe,
      supabase: supabaseWithUser({ id: "user-42", email: "new@example.com" }),
    }),
  );
  assertEquals(res.status, 200);
  assertEquals(captured.customersCreate, {
    email: "new@example.com",
    metadata: { supabase_uid: "user-42" },
  });
  // The new customer id should flow through to the portal session.
  assertEquals((captured.portalCreate as { customer: string }).customer, "cus_fresh");
});

Deno.test("reuses an existing Stripe customer without calling create", async () => {
  const captured = {} as NonNullable<FakeStripeOptions["captured"]>;
  const stripe = makeFakeStripe({
    existingCustomers: [{ id: "cus_existing" }],
    captured,
  });
  await handleCustomerPortal(postReq(), makeDeps({ stripe }));
  // customersCreate should NOT have been called
  assertEquals(captured.customersCreate, undefined);
  assertEquals((captured.portalCreate as { customer: string }).customer, "cus_existing");
});

// ── Portal session URL ──────────────────────────────────────────────

Deno.test("uses an allow-listed origin for return_url", async () => {
  const captured = {} as NonNullable<FakeStripeOptions["captured"]>;
  const stripe = makeFakeStripe({ captured });
  const req = postReq({ origin: "https://my-app.example.com" });
  await handleCustomerPortal(
    req,
    makeDeps({
      stripe,
      isAllowedOrigin: (o) => o === "https://my-app.example.com",
    }),
  );
  assertEquals((captured.portalCreate as { return_url: string }).return_url, "https://my-app.example.com/settings?tab=billing");
});

Deno.test("falls back to defaultBillingOrigin for a non-allow-listed origin", async () => {
  const captured = {} as NonNullable<FakeStripeOptions["captured"]>;
  const stripe = makeFakeStripe({ captured });
  const req = postReq({ origin: "https://evil.com" });
  await handleCustomerPortal(req, makeDeps({
    stripe,
    isAllowedOrigin: () => false,
    defaultBillingOrigin: "https://tenureiq.com",
  }));
  assertEquals((captured.portalCreate as { return_url: string }).return_url, "https://tenureiq.com/settings?tab=billing");
});

Deno.test("falls back to defaultBillingOrigin when no origin header is present", async () => {
  const captured = {} as NonNullable<FakeStripeOptions["captured"]>;
  const stripe = makeFakeStripe({ captured });
  await handleCustomerPortal(postReq(), makeDeps({ stripe, defaultBillingOrigin: "https://tenureiq.com" }));
  assertEquals((captured.portalCreate as { return_url: string }).return_url, "https://tenureiq.com/settings?tab=billing");
});

Deno.test("returns the Stripe portal URL in the response body", async () => {
  const stripe = makeFakeStripe({ portalUrl: "https://billing.stripe.com/p/session_xyz" });
  const res = await handleCustomerPortal(postReq(), makeDeps({ stripe }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.url, "https://billing.stripe.com/p/session_xyz");
});

// ── Error path ──────────────────────────────────────────────────────

Deno.test("500 with the error message when Stripe throws", async () => {
  const restore = quietConsole();
  try {
    const stripe: StripeLike = {
      customers: {
        list: async () => { throw new Error("rate-limited"); },
        create: async () => ({ id: "x" }),
      },
      billingPortal: { sessions: { create: async () => ({ url: "x" }) } },
    };
    const res = await handleCustomerPortal(postReq(), makeDeps({ stripe }));
    assertEquals(res.status, 500);
    const body = await res.json();
    assertEquals(body.error, "rate-limited");
  } finally { restore(); }
});
