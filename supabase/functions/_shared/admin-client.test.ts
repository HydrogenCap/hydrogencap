/**
 * Unit tests for the shared admin client. Run with:
 *
 *   deno test supabase/functions/_shared/admin-client.test.ts --allow-env --allow-net
 *
 * Covers the env-missing failure paths and the happy path. Mirrors the style
 * of `_shared/rateLimit.test.ts`.
 */
import {
  getAdminClient,
  type AdminSupabaseLike,
} from "./admin-client.ts";

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}

function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => void,
): void {
  const prior: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prior[k] = Deno.env.get(k);
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(prior)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

Deno.test("getAdminClient throws when SUPABASE_URL is missing", () => {
  withEnv(
    { SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: "test-key" },
    () => {
      let err: unknown;
      try {
        getAdminClient();
      } catch (e) {
        err = e;
      }
      assert(err instanceof Error, "expected Error to be thrown");
      assert(
        (err as Error).message.includes("SUPABASE_URL") ||
          (err as Error).message.includes("SUPABASE_SERVICE_ROLE_KEY"),
        `unexpected error message: ${(err as Error).message}`,
      );
    },
  );
});

Deno.test("getAdminClient throws when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
  withEnv(
    {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    },
    () => {
      let err: unknown;
      try {
        getAdminClient();
      } catch (e) {
        err = e;
      }
      assert(err instanceof Error, "expected Error to be thrown");
      assert(
        (err as Error).message.includes("SUPABASE_SERVICE_ROLE_KEY") ||
          (err as Error).message.includes("SUPABASE_URL"),
        `unexpected error message: ${(err as Error).message}`,
      );
    },
  );
});

Deno.test({
  name: "getAdminClient returns a client with a .from() method when env is set",
  // The underlying supabase-js client schedules auth-refresh timers we don't
  // own; suppress leak detection for this single happy-path test.
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      },
      () => {
        const client = getAdminClient();
        assert(client, "expected a client instance");
        assert(typeof client.from === "function", "client.from must be a function");
        const builder = client.from("any_table");
        assert(builder, "from() should return a query builder");
      },
    );
  },
});

Deno.test("AdminSupabaseLike accepts a minimal structural stub", () => {
  // Compile-time assertion: the stub below must satisfy the structural type.
  const stub: AdminSupabaseLike = {
    from: (_table: string) => ({}),
  };
  assert(typeof stub.from === "function");
});
