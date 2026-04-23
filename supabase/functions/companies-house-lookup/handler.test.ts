/**
 * Unit tests for companies-house-lookup handler. Run with:
 *
 *   deno test supabase/functions/companies-house-lookup/handler.test.ts --allow-env
 */
import {
  handleCompaniesHouseLookup,
  formatRegisteredAddress,
  pickAccountsDueDate,
  pickAccountsPeriodEnd,
  findAccountsFiling,
  findConfirmationStatementFiling,
  type HandleDeps,
  type SupabaseLike,
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

// ── Defaults ────────────────────────────────────────────────────────

function okUserSupabase(): SupabaseLike {
  return { auth: { getUser: async () => ({ data: { user: { id: "u-1" } }, error: null }) } };
}

function noUserSupabase(): SupabaseLike {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: { message: "bad" } }),
    },
  };
}

function makeDeps(overrides: Partial<HandleDeps> = {}): HandleDeps {
  return {
    supabase: okUserSupabase(),
    fetch: async () => new Response("{}", { status: 200 }),
    corsHeaders: { "Access-Control-Allow-Origin": "*" },
    apiKey: "ch_api_key_test",
    ...overrides,
  };
}

function req(body: unknown, method = "POST", headers: Record<string, string> = {}): Request {
  return new Request("https://fn.test/", {
    method,
    headers: { Authorization: "Bearer user-tok", "Content-Type": "application/json", ...headers },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

// ── Pure helpers ────────────────────────────────────────────────────

Deno.test("formatRegisteredAddress — returns null when no address", () => {
  assertEquals(formatRegisteredAddress(undefined), null);
});

Deno.test("formatRegisteredAddress — joins non-empty parts with ', '", () => {
  assertEquals(
    formatRegisteredAddress({ address_line_1: "10 High St", locality: "Oxford", postal_code: "OX1 1AA", country: "UK" }),
    "10 High St, Oxford, OX1 1AA, UK",
  );
});

Deno.test("formatRegisteredAddress — skips empty/undefined fields", () => {
  assertEquals(
    formatRegisteredAddress({ address_line_1: "10 High St", address_line_2: undefined, postal_code: "OX1 1AA" }),
    "10 High St, OX1 1AA",
  );
});

Deno.test("formatRegisteredAddress — returns null when all parts are empty", () => {
  assertEquals(formatRegisteredAddress({}), null);
});

Deno.test("pickAccountsDueDate — prefers next_due over next_accounts.due_on", () => {
  assertEquals(pickAccountsDueDate({ next_due: "2025-06-01", next_accounts: { due_on: "2025-07-01" } }), "2025-06-01");
});

Deno.test("pickAccountsDueDate — falls back to next_accounts.due_on", () => {
  assertEquals(pickAccountsDueDate({ next_accounts: { due_on: "2025-07-01" } }), "2025-07-01");
});

Deno.test("pickAccountsDueDate — returns null when both are missing", () => {
  assertEquals(pickAccountsDueDate({}), null);
  assertEquals(pickAccountsDueDate(undefined), null);
});

Deno.test("pickAccountsPeriodEnd — prefers next_accounts over last_accounts", () => {
  assertEquals(
    pickAccountsPeriodEnd({
      next_accounts: { period_end_on: "2025-12-31" },
      last_accounts: { period_end_on: "2024-12-31" },
    }),
    "2025-12-31",
  );
});

Deno.test("pickAccountsPeriodEnd — falls back to last_accounts", () => {
  assertEquals(pickAccountsPeriodEnd({ last_accounts: { period_end_on: "2024-12-31" } }), "2024-12-31");
});

Deno.test("findAccountsFiling — matches by category", () => {
  const found = findAccountsFiling([
    { date: "2024-09-01", type: "CS01", description: "Confirmation statement", category: "confirmation-statement" },
    { date: "2024-10-01", type: "AA", description: "Annual accounts", category: "accounts" },
  ]);
  assertEquals(found?.date, "2024-10-01");
});

Deno.test("findAccountsFiling — matches by type keyword", () => {
  const found = findAccountsFiling([
    { date: "2024-10-01", type: "Full accounts", description: "Full accounts", category: "other" },
  ]);
  assertEquals(found?.date, "2024-10-01");
});

Deno.test("findAccountsFiling — returns undefined when no match", () => {
  const found = findAccountsFiling([
    { date: "2024-09-01", type: "CS01", description: "Confirmation statement", category: "confirmation-statement" },
  ]);
  assertEquals(found, undefined);
});

Deno.test("findConfirmationStatementFiling — matches by category", () => {
  const found = findConfirmationStatementFiling([
    { date: "2024-10-01", type: "AA", description: "Annual accounts", category: "accounts" },
    { date: "2024-09-01", type: "CS01", description: "Confirmation statement", category: "confirmation-statement" },
  ]);
  assertEquals(found?.date, "2024-09-01");
});

// ── Handler — auth + validation ─────────────────────────────────────

Deno.test("returns null body + corsHeaders on OPTIONS preflight", async () => {
  const res = await handleCompaniesHouseLookup(
    new Request("https://fn.test/", { method: "OPTIONS" }),
    makeDeps(),
  );
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("returns 401 when Authorization header is missing", async () => {
  const restore = quietConsole();
  try {
    const bareReq = new Request("https://fn.test/", { method: "POST", body: "{}" });
    const res = await handleCompaniesHouseLookup(bareReq, makeDeps());
    assertEquals(res.status, 401);
  } finally { restore(); }
});

Deno.test("returns 401 when Authorization doesn't start with Bearer", async () => {
  const restore = quietConsole();
  try {
    const r = new Request("https://fn.test/", {
      method: "POST",
      headers: { Authorization: "Basic xyz" },
      body: "{}",
    });
    const res = await handleCompaniesHouseLookup(r, makeDeps());
    assertEquals(res.status, 401);
  } finally { restore(); }
});

Deno.test("returns 401 when supabase.auth.getUser returns null user", async () => {
  const restore = quietConsole();
  try {
    const res = await handleCompaniesHouseLookup(
      req({ action: "search", searchQuery: "Acme" }),
      makeDeps({ supabase: noUserSupabase() }),
    );
    assertEquals(res.status, 401);
  } finally { restore(); }
});

Deno.test("returns 500 when COMPANIES_HOUSE_API_KEY is missing", async () => {
  const restore = quietConsole();
  try {
    const res = await handleCompaniesHouseLookup(
      req({ action: "search", searchQuery: "Acme" }),
      makeDeps({ apiKey: undefined }),
    );
    assertEquals(res.status, 500);
    const body = await res.json();
    assert(String(body.error).includes("API key"));
  } finally { restore(); }
});

Deno.test("returns 400 when action is invalid or required arg missing", async () => {
  const restore = quietConsole();
  try {
    const res = await handleCompaniesHouseLookup(
      req({ action: "search" }), // no searchQuery
      makeDeps(),
    );
    assertEquals(res.status, 400);
  } finally { restore(); }
});

// ── Search path ─────────────────────────────────────────────────────

Deno.test("search — calls the CH /search/companies endpoint with Basic auth", async () => {
  const restore = quietConsole();
  try {
    let rcvUrl: string | undefined;
    let rcvAuth: string | null = null;
    const fakeFetch = async (url: string, init?: RequestInit) => {
      rcvUrl = url;
      rcvAuth = (init?.headers as Record<string, string>).Authorization ?? null;
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    };
    await handleCompaniesHouseLookup(
      req({ action: "search", searchQuery: "Acme & Co Ltd" }),
      makeDeps({ fetch: fakeFetch, apiKey: "the-key" }),
    );
    assertEquals(rcvUrl, "https://api.company-information.service.gov.uk/search/companies?q=Acme%20%26%20Co%20Ltd&items_per_page=10");
    // Basic auth: base64("the-key:")
    assertEquals(rcvAuth, `Basic ${btoa("the-key:")}`);
  } finally { restore(); }
});

Deno.test("search — maps Companies House response to the client contract", async () => {
  const restore = quietConsole();
  try {
    const fakeFetch = async () => new Response(JSON.stringify({
      items: [
        {
          company_number: "12345678",
          title: "Acme Holdings Ltd",
          company_status: "active",
          date_of_creation: "2010-01-01",
          address_snippet: "London, UK",
        },
      ],
    }), { status: 200 });
    const res = await handleCompaniesHouseLookup(
      req({ action: "search", searchQuery: "Acme" }),
      makeDeps({ fetch: fakeFetch }),
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.companies.length, 1);
    assertEquals(body.companies[0].company_number, "12345678");
    assertEquals(body.companies[0].company_name, "Acme Holdings Ltd"); // title → company_name
    assertEquals(body.companies[0].address_snippet, "London, UK");
  } finally { restore(); }
});

Deno.test("search — propagates CH API error status to the client", async () => {
  const restore = quietConsole();
  try {
    const fakeFetch = async () => new Response("rate limited", { status: 429 });
    const res = await handleCompaniesHouseLookup(
      req({ action: "search", searchQuery: "Acme" }),
      makeDeps({ fetch: fakeFetch }),
    );
    assertEquals(res.status, 429);
  } finally { restore(); }
});

Deno.test("search — returns empty array when CH returns no items", async () => {
  const restore = quietConsole();
  try {
    const fakeFetch = async () => new Response(JSON.stringify({}), { status: 200 });
    const res = await handleCompaniesHouseLookup(
      req({ action: "search", searchQuery: "Nothing Ltd" }),
      makeDeps({ fetch: fakeFetch }),
    );
    const body = await res.json();
    assertEquals(body.companies, []);
  } finally { restore(); }
});

// ── Lookup path ─────────────────────────────────────────────────────

function makeLookupFetch(responses: Partial<Record<"profile" | "officers" | "pscs" | "filing", Response>>): HandleDeps["fetch"] {
  return async (url: string) => {
    if (url.endsWith("/officers")) return responses.officers ?? new Response("{}", { status: 404 });
    if (url.endsWith("/persons-with-significant-control")) return responses.pscs ?? new Response("{}", { status: 404 });
    if (url.includes("/filing-history")) return responses.filing ?? new Response("{}", { status: 404 });
    return responses.profile ?? new Response("{}", { status: 404 });
  };
}

Deno.test("lookup — 404 from the profile endpoint becomes 404 to the client", async () => {
  const restore = quietConsole();
  try {
    const fakeFetch = makeLookupFetch({ profile: new Response("not found", { status: 404 }) });
    const res = await handleCompaniesHouseLookup(
      req({ action: "lookup", companyNumber: "99999999" }),
      makeDeps({ fetch: fakeFetch }),
    );
    assertEquals(res.status, 404);
  } finally { restore(); }
});

Deno.test("lookup — returns a fully-shaped payload on success", async () => {
  const restore = quietConsole();
  try {
    const profile = new Response(JSON.stringify({
      company_number: "12345678",
      company_name: "Acme Ltd",
      company_status: "active",
      company_type: "ltd",
      date_of_creation: "2010-01-01",
      registered_office_address: { address_line_1: "10 High St", postal_code: "OX1 1AA" },
      accounts: { next_due: "2025-12-31", next_accounts: { period_end_on: "2025-06-30" } },
      confirmation_statement: { next_due: "2025-08-01", last_made_up_to: "2024-08-01" },
    }), { status: 200 });
    const officers = new Response(JSON.stringify({
      items: [
        { name: "Alice Smith", officer_role: "director", appointed_on: "2020-01-01" },
        { name: "Ex Director", officer_role: "director", appointed_on: "2018-01-01", resigned_on: "2022-01-01" },
      ],
    }), { status: 200 });
    const pscs = new Response(JSON.stringify({
      items: [
        {
          name: "Alice Smith",
          kind: "individual-person-with-significant-control",
          natures_of_control: ["ownership-of-shares-75-to-100-percent"],
          notified_on: "2020-01-01",
        },
        {
          name_elements: { forename: "Bob", surname: "Jones" },
          kind: "individual-person-with-significant-control",
          natures_of_control: ["voting-rights-25-to-50-percent"],
          notified_on: "2021-06-01",
          ceased_on: "2023-01-01", // excluded
        },
      ],
    }), { status: 200 });
    const filing = new Response(JSON.stringify({
      items: [
        { date: "2024-10-01", type: "AA", description: "Annual accounts", category: "accounts" },
        { date: "2024-09-01", type: "CS01", description: "Confirmation statement", category: "confirmation-statement" },
      ],
    }), { status: 200 });

    const res = await handleCompaniesHouseLookup(
      req({ action: "lookup", companyNumber: "12345678" }),
      makeDeps({ fetch: makeLookupFetch({ profile, officers, pscs, filing }) }),
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.company.company_name, "Acme Ltd");
    assertEquals(body.company.registered_address, "10 High St, OX1 1AA");
    assertEquals(body.officers.length, 1);
    assertEquals(body.officers[0].name, "Alice Smith");
    assertEquals(body.officers[0].role, "director");
    assertEquals(body.significant_controllers.length, 1); // ceased PSC filtered out
    assertEquals(body.significant_controllers[0].name, "Alice Smith");
    assertEquals(body.compliance.accounts_due_date, "2025-12-31");
    assertEquals(body.compliance.accounts_period_end, "2025-06-30");
    assertEquals(body.compliance.accounts_last_filed_date, "2024-10-01");
    assertEquals(body.compliance.confirmation_statement_due_date, "2025-08-01");
    assertEquals(body.compliance.confirmation_statement_last_filed_date, "2024-09-01");
  } finally { restore(); }
});

Deno.test("lookup — treats officers/PSCs/filing failures as best-effort (logs + carries on)", async () => {
  const restore = quietConsole();
  try {
    const profile = new Response(JSON.stringify({
      company_number: "x",
      company_name: "Y Ltd",
      company_status: "active",
      company_type: "ltd",
      date_of_creation: "2020-01-01",
    }), { status: 200 });
    const fakeFetch = makeLookupFetch({
      profile,
      officers: new Response("{}", { status: 500 }),
      pscs: new Response("{}", { status: 500 }),
      filing: new Response("{}", { status: 500 }),
    });
    const res = await handleCompaniesHouseLookup(
      req({ action: "lookup", companyNumber: "x" }),
      makeDeps({ fetch: fakeFetch }),
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.officers, []);
    assertEquals(body.significant_controllers, []);
    assertEquals(body.compliance.accounts_last_filed_date, null);
    assertEquals(body.compliance.confirmation_statement_last_filed_date, null);
  } finally { restore(); }
});

Deno.test("lookup — constructs PSC name from forename + surname when name field is missing", async () => {
  const restore = quietConsole();
  try {
    const profile = new Response(JSON.stringify({
      company_number: "x", company_name: "y", company_status: "active", company_type: "ltd", date_of_creation: "2020-01-01",
    }), { status: 200 });
    const pscs = new Response(JSON.stringify({
      items: [{
        name_elements: { forename: "Claire", surname: "Brown" },
        kind: "individual-person-with-significant-control",
        natures_of_control: [],
        notified_on: "2022-01-01",
      }],
    }), { status: 200 });
    const res = await handleCompaniesHouseLookup(
      req({ action: "lookup", companyNumber: "x" }),
      makeDeps({ fetch: makeLookupFetch({ profile, pscs }) }),
    );
    const body = await res.json();
    assertEquals(body.significant_controllers[0].name, "Claire Brown");
  } finally { restore(); }
});
