/**
 * Unit tests for the freeagent-sync-payments helpers. Run with:
 *
 *   deno test supabase/functions/freeagent-sync-payments/helpers.test.ts --allow-env
 *
 * No network, no esm.sh — crypto uses the Web Crypto API (built into Deno);
 * Supabase and fetch are injected fakes.
 */
import {
  deriveKey,
  encryptWithKey,
  decryptWithKey,
  getValidToken,
  getOrCreateContact,
  type FreeAgentConnection,
  type SupabaseLike,
} from "./helpers.ts";

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  const equal = actual === expected || JSON.stringify(actual) === JSON.stringify(expected);
  if (!equal) {
    throw new Error(msg ?? `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ── Crypto ──────────────────────────────────────────────────────────

Deno.test("deriveKey — returns an AES-GCM CryptoKey", async () => {
  const key = await deriveKey("my-secret-passphrase");
  assertEquals(key.algorithm.name, "AES-GCM");
});

Deno.test("deriveKey — same passphrase produces equivalent keys (roundtrip test)", async () => {
  const key1 = await deriveKey("same-passphrase");
  const key2 = await deriveKey("same-passphrase");
  const cipher = await encryptWithKey("hello", key1);
  const plain = await decryptWithKey(cipher, key2);
  assertEquals(plain, "hello");
});

Deno.test("encrypt/decrypt — roundtrips a plaintext", async () => {
  const key = await deriveKey("the-passphrase");
  const plaintext = "sensitive-access-token-abc123";
  const ciphertext = await encryptWithKey(plaintext, key);
  assert(ciphertext !== plaintext, "ciphertext should differ from plaintext");
  const decrypted = await decryptWithKey(ciphertext, key);
  assertEquals(decrypted, plaintext);
});

Deno.test("encrypt — produces different ciphertext for same plaintext (IV randomness)", async () => {
  const key = await deriveKey("x");
  const c1 = await encryptWithKey("same", key);
  const c2 = await encryptWithKey("same", key);
  assert(c1 !== c2, "two encryptions of the same plaintext should differ (IV is random)");
});

Deno.test("decrypt — fails when ciphertext is tampered with", async () => {
  const key = await deriveKey("x");
  const cipher = await encryptWithKey("hello", key);
  // Flip a byte mid-ciphertext.
  const bytes = Uint8Array.from(atob(cipher), (c) => c.charCodeAt(0));
  bytes[bytes.length - 1] ^= 0xff;
  const tampered = btoa(String.fromCharCode(...bytes));
  let threw = false;
  try {
    await decryptWithKey(tampered, key);
  } catch {
    threw = true;
  }
  assert(threw, "tampered ciphertext must not decrypt");
});

Deno.test("decrypt — fails when wrong key is used", async () => {
  const key1 = await deriveKey("one-passphrase");
  const key2 = await deriveKey("different-passphrase");
  const cipher = await encryptWithKey("hello", key1);
  let threw = false;
  try {
    await decryptWithKey(cipher, key2);
  } catch {
    threw = true;
  }
  assert(threw, "wrong key must not decrypt");
});

Deno.test("encrypt/decrypt — handles UTF-8 characters", async () => {
  const key = await deriveKey("x");
  const plaintext = "héllo 🔑 résumé";
  const cipher = await encryptWithKey(plaintext, key);
  assertEquals(await decryptWithKey(cipher, key), plaintext);
});

Deno.test("encrypt/decrypt — handles empty string", async () => {
  const key = await deriveKey("x");
  const cipher = await encryptWithKey("", key);
  assertEquals(await decryptWithKey(cipher, key), "");
});

// ── getValidToken ───────────────────────────────────────────────────

interface FakeUpdate {
  table: string;
  payload: Record<string, unknown>;
  filterId: string | undefined;
}

function makeFakeSupabase(): { client: SupabaseLike; updates: FakeUpdate[] } {
  const updates: FakeUpdate[] = [];
  const client: SupabaseLike = {
    from(table: string) {
      let payload: Record<string, unknown> = {};
      const builder = {
        update(p: Record<string, unknown>) { payload = p; return builder; },
        eq(_k: string, v: string) {
          updates.push({ table, payload, filterId: v });
          return Promise.resolve({ data: null, error: null });
        },
      };
      return builder;
    },
  };
  return { client, updates };
}

async function makeConnection(
  opts: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
    useSandbox?: boolean;
    key: CryptoKey;
  },
): Promise<FreeAgentConnection> {
  return {
    id: "conn-1",
    access_token_encrypted: await encryptWithKey(opts.accessToken ?? "current-access-token", opts.key),
    refresh_token_encrypted: await encryptWithKey(opts.refreshToken ?? "rt-abc", opts.key),
    token_expires_at: opts.expiresAt ?? new Date(Date.now() + 3600_000).toISOString(),
    use_sandbox: opts.useSandbox ?? false,
  };
}

Deno.test("getValidToken — fast path: token is still valid, returns decrypted access token", async () => {
  const key = await deriveKey("secret");
  const conn = await makeConnection({
    accessToken: "still-good",
    expiresAt: new Date(Date.now() + 60 * 60000).toISOString(), // 1 hour away
    key,
  });
  const { client } = makeFakeSupabase();
  let fetched = false;
  const result = await getValidToken(conn, {
    supabase: client,
    fetch: async () => { fetched = true; return new Response("{}"); },
    key,
    clientId: "id",
    clientSecret: "sec",
  });
  assertEquals(result, "still-good");
  assertEquals(fetched, false);
});

Deno.test("getValidToken — refreshes when token expires within 5 minutes", async () => {
  const key = await deriveKey("secret");
  const conn = await makeConnection({
    accessToken: "old-one",
    refreshToken: "rt-old",
    expiresAt: new Date(Date.now() + 2 * 60000).toISOString(), // 2 minutes away
    key,
  });
  const { client, updates } = makeFakeSupabase();
  let fetchedUrl: string | undefined;
  let fetchedBody: URLSearchParams | undefined;
  const fakeFetch = async (url: string, init: RequestInit | undefined) => {
    fetchedUrl = url;
    fetchedBody = new URLSearchParams(init?.body as string);
    return new Response(
      JSON.stringify({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 }),
      { status: 200 },
    );
  };
  const result = await getValidToken(conn, {
    supabase: client,
    fetch: fakeFetch,
    key,
    clientId: "client-id-xyz",
    clientSecret: "client-secret-abc",
  });
  assertEquals(result, "new-access");
  assertEquals(fetchedUrl, "https://api.freeagent.com/v2/token_endpoint");
  assertEquals(fetchedBody!.get("grant_type"), "refresh_token");
  assertEquals(fetchedBody!.get("refresh_token"), "rt-old");
  // A DB update should have landed on freeagent_connections with new encrypted tokens.
  assertEquals(updates.length, 1);
  assertEquals(updates[0].table, "freeagent_connections");
  assertEquals(updates[0].filterId, "conn-1");
  // Stored tokens are encrypted — decrypt to verify.
  const stored = updates[0].payload as { access_token_encrypted: string; refresh_token_encrypted: string };
  assertEquals(await decryptWithKey(stored.access_token_encrypted, key), "new-access");
  assertEquals(await decryptWithKey(stored.refresh_token_encrypted, key), "new-refresh");
});

Deno.test("getValidToken — sandbox connections hit the sandbox API base", async () => {
  const key = await deriveKey("secret");
  const conn = await makeConnection({
    expiresAt: new Date(Date.now() + 60000).toISOString(), // 1 minute → refresh
    useSandbox: true,
    key,
  });
  const { client } = makeFakeSupabase();
  let url: string | undefined;
  const fakeFetch = async (u: string) => {
    url = u;
    return new Response(JSON.stringify({ access_token: "a", refresh_token: "b", expires_in: 3600 }));
  };
  await getValidToken(conn, {
    supabase: client, fetch: fakeFetch, key, clientId: "c", clientSecret: "s",
  });
  assertEquals(url, "https://api.sandbox.freeagent.com/v2/token_endpoint");
});

Deno.test("getValidToken — throws when the refresh call fails", async () => {
  const key = await deriveKey("secret");
  const conn = await makeConnection({
    expiresAt: new Date(Date.now() + 60000).toISOString(), // refresh required
    key,
  });
  const { client } = makeFakeSupabase();
  const fakeFetch = async () => new Response("invalid_grant", { status: 401 });
  let threw: Error | undefined;
  try {
    await getValidToken(conn, { supabase: client, fetch: fakeFetch, key, clientId: "c", clientSecret: "s" });
  } catch (e) {
    threw = e as Error;
  }
  assert(threw instanceof Error);
  assert(threw!.message.includes("401"));
});

Deno.test("getValidToken — sends Basic auth with client_id:client_secret", async () => {
  const key = await deriveKey("secret");
  const conn = await makeConnection({
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    key,
  });
  const { client } = makeFakeSupabase();
  let auth: string | null = null;
  const fakeFetch = async (_url: string, init?: RequestInit) => {
    auth = (init?.headers as Record<string, string>).Authorization ?? null;
    return new Response(JSON.stringify({ access_token: "x", refresh_token: "y", expires_in: 3600 }));
  };
  await getValidToken(conn, {
    supabase: client, fetch: fakeFetch, key, clientId: "my-id", clientSecret: "my-secret",
  });
  const expected = `Basic ${btoa("my-id:my-secret")}`;
  assertEquals(auth, expected);
});

Deno.test("getValidToken — defaults expires_in to 3600 when the response omits it", async () => {
  const key = await deriveKey("secret");
  const conn = await makeConnection({
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    key,
  });
  const { client, updates } = makeFakeSupabase();
  const fakeFetch = async () => new Response(JSON.stringify({ access_token: "x", refresh_token: "y" }));
  const before = Date.now();
  await getValidToken(conn, { supabase: client, fetch: fakeFetch, key, clientId: "c", clientSecret: "s" });
  const after = Date.now();
  const stored = updates[0].payload as { token_expires_at: string };
  const expiresMs = new Date(stored.token_expires_at).getTime();
  // Should be ~ now + 3600s
  assert(expiresMs >= before + 3500_000);
  assert(expiresMs <= after + 3700_000);
});

// ── getOrCreateContact ──────────────────────────────────────────────

Deno.test("getOrCreateContact — returns the URL of an existing matching contact (by first+last)", async () => {
  const contacts = [
    { url: "https://api/contacts/1", first_name: "Alice", last_name: "Smith" },
    { url: "https://api/contacts/2", first_name: "Bob", last_name: "Jones" },
  ];
  const fakeFetch = async () => new Response(JSON.stringify({ contacts }), { status: 200 });
  const url = await getOrCreateContact(
    "https://api",
    "token",
    "Alice Smith",
    null,
    "10 High St",
    fakeFetch,
  );
  assertEquals(url, "https://api/contacts/1");
});

Deno.test("getOrCreateContact — matches by organisation_name when first+last doesn't match", async () => {
  const contacts = [
    { url: "https://api/contacts/org", organisation_name: "Acme Rentals", first_name: "", last_name: "" },
  ];
  const fakeFetch = async () => new Response(JSON.stringify({ contacts }), { status: 200 });
  const url = await getOrCreateContact(
    "https://api",
    "token",
    "Acme Rentals",
    null,
    "10 High St",
    fakeFetch,
  );
  assertEquals(url, "https://api/contacts/org");
});

Deno.test("getOrCreateContact — creates a new contact when none match", async () => {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const fakeFetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body });
    if (init?.method === "POST") {
      return new Response(JSON.stringify({ contact: { url: "https://api/contacts/new" } }), { status: 201 });
    }
    return new Response(JSON.stringify({ contacts: [] }), { status: 200 });
  };
  const url = await getOrCreateContact(
    "https://api",
    "tok",
    "Charlie Brown",
    "charlie@example.com",
    "5 Low Rd",
    fakeFetch,
  );
  assertEquals(url, "https://api/contacts/new");
  assertEquals(calls.length, 2);
  assertEquals(calls[0].method, "GET");
  assertEquals(calls[1].method, "POST");
  const createBody = JSON.parse(calls[1].body as string) as { contact: Record<string, unknown> };
  assertEquals(createBody.contact.first_name, "Charlie");
  assertEquals(createBody.contact.last_name, "Brown");
  assertEquals(createBody.contact.email, "charlie@example.com");
  assertEquals(createBody.contact.address1, "5 Low Rd");
  assertEquals(createBody.contact.country, "United Kingdom");
  assertEquals(createBody.contact.status, "Active");
});

Deno.test("getOrCreateContact — falls through to create when list call returns non-ok", async () => {
  const fakeFetch = async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      return new Response(JSON.stringify({ contact: { url: "https://api/contacts/new" } }), { status: 201 });
    }
    return new Response("service unavailable", { status: 503 });
  };
  const url = await getOrCreateContact("https://api", "tok", "A B", null, "addr", fakeFetch);
  assertEquals(url, "https://api/contacts/new");
});

Deno.test("getOrCreateContact — throws when create fails", async () => {
  const fakeFetch = async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      return new Response("validation error", { status: 422 });
    }
    return new Response(JSON.stringify({ contacts: [] }), { status: 200 });
  };
  let threw: Error | undefined;
  try {
    await getOrCreateContact("https://api", "tok", "A B", null, "addr", fakeFetch);
  } catch (e) {
    threw = e as Error;
  }
  assert(threw);
  assert(threw!.message.includes("validation error"));
});

Deno.test("getOrCreateContact — handles single-word tenant names (no last name)", async () => {
  const calls: { body?: unknown }[] = [];
  const fakeFetch = async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      calls.push({ body: init.body });
      return new Response(JSON.stringify({ contact: { url: "https://api/contacts/new" } }), { status: 201 });
    }
    return new Response(JSON.stringify({ contacts: [] }), { status: 200 });
  };
  await getOrCreateContact("https://api", "tok", "Madonna", null, "addr", fakeFetch);
  const body = JSON.parse(calls[0].body as string) as { contact: Record<string, unknown> };
  assertEquals(body.contact.first_name, "Madonna");
  assertEquals(body.contact.last_name, "");
});

Deno.test("getOrCreateContact — sends Bearer token on both list and create", async () => {
  const auths: Array<string | null> = [];
  const fakeFetch = async (_url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    auths.push(headers.Authorization ?? null);
    if (init?.method === "POST") {
      return new Response(JSON.stringify({ contact: { url: "u" } }), { status: 201 });
    }
    return new Response(JSON.stringify({ contacts: [] }), { status: 200 });
  };
  await getOrCreateContact("https://api", "my-token", "Alice Smith", null, "addr", fakeFetch);
  assertEquals(auths.length, 2);
  assertEquals(auths[0], "Bearer my-token");
  assertEquals(auths[1], "Bearer my-token");
});
