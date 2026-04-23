/**
 * Unit tests for the ai-gap-fill handler. Run with:
 *
 *   deno test supabase/functions/ai-gap-fill/handler.test.ts --allow-env
 *
 * All dependencies (supabase, rate-limit helpers, subscription check, fetch)
 * are injected via `deps`, so the test has no network side effects.
 */
import {
  handleAiGapFill,
  buildPrompt,
  type HandleAiGapFillDeps,
  type SupabaseLike,
  type RateLimitResult,
  type SubscriptionResult,
} from "./handler.ts";

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  const equal = actual === expected || JSON.stringify(actual) === JSON.stringify(expected);
  if (!equal) {
    throw new Error(msg ?? `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function quietConsole() {
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  return () => { console.log = orig.log; console.warn = orig.warn; console.error = orig.error; };
}

// ── Default deps ────────────────────────────────────────────────────

function okUserSupabase(userId = "user-1"): SupabaseLike {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: userId } }, error: null }),
    },
  };
}

function noUserSupabase(): SupabaseLike {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: { message: "bad token" } }),
    },
  };
}

const defaultRateLimitAllow: RateLimitResult = { allowed: true, remaining: 10, resetAt: "" };
const rateLimitDeny: RateLimitResult = { allowed: false, remaining: 0, resetAt: "2026-04-23T10:00:00Z" };

function defaultDeps(overrides: Partial<HandleAiGapFillDeps> = {}): HandleAiGapFillDeps {
  return {
    supabase: okUserSupabase(),
    checkRateLimit: async () => defaultRateLimitAllow,
    rateLimitResponse: (cors, remaining, resetAt) =>
      new Response(JSON.stringify({ error: "Rate limit exceeded", remaining, resetAt }), {
        status: 429,
        headers: { ...cors, "Content-Type": "application/json" },
      }),
    requireActiveSubscription: async () => ({ allowed: true } as SubscriptionResult),
    fetch: async () => okAiGatewayResponse([]),
    corsHeaders: { "Access-Control-Allow-Origin": "*" },
    lovableApiKey: "lvbl_test",
    ...overrides,
  };
}

function postRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://fn.test/ai-gap-fill", {
    method: "POST",
    headers: { Authorization: "Bearer user-token", "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function okAiGatewayResponse(suggestions: unknown[]): Response {
  return new Response(
    JSON.stringify({
      choices: [{
        message: {
          tool_calls: [{
            function: { arguments: JSON.stringify({ suggestions }) },
          }],
        },
      }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ── buildPrompt (pure) ─────────────────────────────────────────────

Deno.test("buildPrompt — returns null for unknown type", () => {
  assertEquals(buildPrompt("widgets", [{ id: "x" }]), null);
});

Deno.test("buildPrompt — properties: simplifies records and returns a property prompt", () => {
  const result = buildPrompt("properties", [{
    id: "p1",
    address_line_1: "10 High St",
    postcode: "OX1 1AA",
    property_type: "single_let",
    has_gas_supply: null,
    year_built: null,
    total_floors: 2,
    council_name: null,
    council_area: null,
    ignore_me: "bogus",
  }])!;
  assert(result.systemPrompt.includes("UK property data expert"));
  // userPrompt strips out fields like `ignore_me`.
  assert(!result.userPrompt.includes("ignore_me"));
  assert(result.userPrompt.includes("OX1 1AA"));
});

Deno.test("buildPrompt — rooms: simplifies records and returns a room prompt", () => {
  const result = buildPrompt("rooms", [{
    id: "r1",
    room_name: "Master",
    property_address: "10 High St",
    room_type: "double",
    current_rent_pcm: 600,
    target_rent_pcm: null,
    floor: null,
  }])!;
  assert(result.systemPrompt.includes("UK property rental expert"));
  assert(result.userPrompt.includes('"room_name": "Master"'));
});

// ── Auth + CORS ─────────────────────────────────────────────────────

Deno.test("returns corsHeaders + null body on OPTIONS preflight", async () => {
  const restore = quietConsole();
  try {
    const res = await handleAiGapFill(
      new Request("https://fn.test/", { method: "OPTIONS" }),
      defaultDeps(),
    );
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  } finally { restore(); }
});

Deno.test("returns 401 when Authorization header is missing", async () => {
  const restore = quietConsole();
  try {
    const req = new Request("https://fn.test/", { method: "POST", body: "{}" });
    const res = await handleAiGapFill(req, defaultDeps());
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error, "Unauthorized");
  } finally { restore(); }
});

Deno.test("returns 401 when Authorization scheme isn't Bearer", async () => {
  const restore = quietConsole();
  try {
    const req = new Request("https://fn.test/", {
      method: "POST",
      headers: { Authorization: "Basic xyz" },
      body: "{}",
    });
    const res = await handleAiGapFill(req, defaultDeps());
    assertEquals(res.status, 401);
  } finally { restore(); }
});

Deno.test("returns 401 when supabase.auth.getUser returns an error or null user", async () => {
  const restore = quietConsole();
  try {
    const res = await handleAiGapFill(
      postRequest({ type: "properties", records: [{ id: "p1" }] }),
      defaultDeps({ supabase: noUserSupabase() }),
    );
    assertEquals(res.status, 401);
  } finally { restore(); }
});

// ── Subscription + rate-limit gates ─────────────────────────────────

Deno.test("returns the subscription deny response when sub-check fails", async () => {
  const restore = quietConsole();
  try {
    const denyResponse = new Response(JSON.stringify({ error: "Active subscription required" }), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });
    const res = await handleAiGapFill(
      postRequest({ type: "properties", records: [{ id: "p1" }] }),
      defaultDeps({ requireActiveSubscription: async () => ({ allowed: false, response: denyResponse }) }),
    );
    assertEquals(res.status, 402);
  } finally { restore(); }
});

Deno.test("returns 429 from the rate-limit path when the user is over cap", async () => {
  const restore = quietConsole();
  try {
    const res = await handleAiGapFill(
      postRequest({ type: "properties", records: [{ id: "p1" }] }),
      defaultDeps({ checkRateLimit: async () => rateLimitDeny }),
    );
    assertEquals(res.status, 429);
    const body = await res.json();
    assertEquals(body.error, "Rate limit exceeded");
    assertEquals(body.resetAt, "2026-04-23T10:00:00Z");
  } finally { restore(); }
});

Deno.test("passes the auth'd user id + 'ai-gap-fill' function name + 20/60 limits to checkRateLimit", async () => {
  const restore = quietConsole();
  try {
    let rcvArgs: { userId: string; fnName: string; max: number; win: number } | undefined;
    await handleAiGapFill(
      postRequest({ type: "properties", records: [{ id: "p1" }] }),
      defaultDeps({
        supabase: okUserSupabase("user-42"),
        checkRateLimit: async (userId, fnName, max, win) => {
          rcvArgs = { userId, fnName, max, win };
          return defaultRateLimitAllow;
        },
      }),
    );
    assertEquals(rcvArgs, { userId: "user-42", fnName: "ai-gap-fill", max: 20, win: 60 });
  } finally { restore(); }
});

// ── Request validation ─────────────────────────────────────────────

Deno.test("returns 500 when LOVABLE_API_KEY is missing", async () => {
  const restore = quietConsole();
  try {
    const res = await handleAiGapFill(
      postRequest({ type: "properties", records: [{ id: "p1" }] }),
      defaultDeps({ lovableApiKey: undefined }),
    );
    assertEquals(res.status, 500);
    const body = await res.json();
    assert(String(body.error).includes("LOVABLE_API_KEY"));
  } finally { restore(); }
});

Deno.test("returns 400 when the body has no type", async () => {
  const restore = quietConsole();
  try {
    const res = await handleAiGapFill(postRequest({ records: [{ id: "p1" }] }), defaultDeps());
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, "type and records are required");
  } finally { restore(); }
});

Deno.test("returns 400 when records is empty", async () => {
  const restore = quietConsole();
  try {
    const res = await handleAiGapFill(postRequest({ type: "properties", records: [] }), defaultDeps());
    assertEquals(res.status, 400);
  } finally { restore(); }
});

Deno.test("returns 400 for an unsupported type", async () => {
  const restore = quietConsole();
  try {
    const res = await handleAiGapFill(
      postRequest({ type: "widgets", records: [{ id: "x" }] }),
      defaultDeps(),
    );
    assertEquals(res.status, 400);
    const body = await res.json();
    assert(String(body.error).includes("Unsupported type"));
  } finally { restore(); }
});

// ── AI gateway interaction ─────────────────────────────────────────

Deno.test("sends the LOVABLE_API_KEY as Bearer and model gemini-2.5-flash", async () => {
  const restore = quietConsole();
  try {
    let rcvUrl: string | undefined;
    let rcvAuth: string | null = null;
    let rcvBody: Record<string, unknown> = {};
    const capturingFetch: HandleAiGapFillDeps["fetch"] = async (url, init) => {
      rcvUrl = url;
      rcvAuth = (init.headers as Record<string, string>).Authorization ?? null;
      rcvBody = JSON.parse(init.body as string);
      return okAiGatewayResponse([]);
    };
    await handleAiGapFill(
      postRequest({ type: "properties", records: [{ id: "p1", address_line_1: "10 High St" }] }),
      defaultDeps({ fetch: capturingFetch }),
    );
    assertEquals(rcvUrl, "https://ai.gateway.lovable.dev/v1/chat/completions");
    assertEquals(rcvAuth, "Bearer lvbl_test");
    assertEquals(rcvBody.model, "google/gemini-2.5-flash");
    const tools = rcvBody.tools as Array<{ function: { name: string } }>;
    assertEquals(tools[0].function.name, "suggest_gap_fills");
  } finally { restore(); }
});

Deno.test("returns parsed suggestions on a successful AI response", async () => {
  const restore = quietConsole();
  try {
    const suggestions = [{ id: "p1", year_built: 1935 }, { id: "p2", has_gas_supply: true }];
    const res = await handleAiGapFill(
      postRequest({ type: "properties", records: [{ id: "p1" }, { id: "p2" }] }),
      defaultDeps({ fetch: async () => okAiGatewayResponse(suggestions) }),
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.suggestions, suggestions);
  } finally { restore(); }
});

Deno.test("propagates 429 rate limit from the AI gateway to the client", async () => {
  const restore = quietConsole();
  try {
    const res = await handleAiGapFill(
      postRequest({ type: "properties", records: [{ id: "p1" }] }),
      defaultDeps({ fetch: async () => new Response("{}", { status: 429 }) }),
    );
    assertEquals(res.status, 429);
    const body = await res.json();
    assert(String(body.error).includes("Rate limit"));
  } finally { restore(); }
});

Deno.test("propagates 402 credit exhaustion from the AI gateway to the client", async () => {
  const restore = quietConsole();
  try {
    const res = await handleAiGapFill(
      postRequest({ type: "properties", records: [{ id: "p1" }] }),
      defaultDeps({ fetch: async () => new Response("{}", { status: 402 }) }),
    );
    assertEquals(res.status, 402);
    const body = await res.json();
    assert(String(body.error).includes("Usage limit"));
  } finally { restore(); }
});

Deno.test("returns 500 on other AI gateway errors (e.g. 500)", async () => {
  const restore = quietConsole();
  try {
    const res = await handleAiGapFill(
      postRequest({ type: "properties", records: [{ id: "p1" }] }),
      defaultDeps({ fetch: async () => new Response("server broke", { status: 500 }) }),
    );
    assertEquals(res.status, 500);
    const body = await res.json();
    assertEquals(body.error, "AI gateway error");
  } finally { restore(); }
});

Deno.test("returns 500 when the AI response has no tool_calls arguments", async () => {
  const restore = quietConsole();
  try {
    const noToolResponse = new Response(
      JSON.stringify({ choices: [{ message: { content: "prose response" } }] }),
      { status: 200 },
    );
    const res = await handleAiGapFill(
      postRequest({ type: "properties", records: [{ id: "p1" }] }),
      defaultDeps({ fetch: async () => noToolResponse }),
    );
    assertEquals(res.status, 500);
    const body = await res.json();
    assert(String(body.error).includes("No suggestions"));
  } finally { restore(); }
});

Deno.test("routes rooms type through to the rooms prompt", async () => {
  const restore = quietConsole();
  try {
    let rcvBody: Record<string, unknown> = {};
    const capturingFetch: HandleAiGapFillDeps["fetch"] = async (_url, init) => {
      rcvBody = JSON.parse(init.body as string);
      return okAiGatewayResponse([]);
    };
    await handleAiGapFill(
      postRequest({ type: "rooms", records: [{ id: "r1", room_name: "Master" }] }),
      defaultDeps({ fetch: capturingFetch }),
    );
    const messages = rcvBody.messages as Array<{ role: string; content: string }>;
    assert(messages[0].content.includes("UK property rental expert"));
  } finally { restore(); }
});
