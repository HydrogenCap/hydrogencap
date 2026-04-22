/**
 * Unit tests for the structured logger. Run with:
 *
 *   deno test supabase/functions/_shared/logger.test.ts
 *
 * Uses zero external imports so tests run offline on a fresh Deno install.
 */
import { createLogger, withLogging } from "./logger.ts";

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) {
    throw new Error(msg ?? `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

type Entry = Record<string, unknown>;

function captureConsole() {
  const entries: { level: "info" | "warn" | "error"; line: string }[] = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = (line: string) => entries.push({ level: "info", line });
  console.warn = (line: string) => entries.push({ level: "warn", line });
  console.error = (line: string) => entries.push({ level: "error", line });
  return {
    entries,
    restore: () => {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    },
    parsed(): (Entry & { level: string })[] {
      return entries.map((e) => ({ ...JSON.parse(e.line), level: e.level }));
    },
  };
}

Deno.test("createLogger.info — emits a JSON line with level, fn, msg, ts, rid", () => {
  const cap = captureConsole();
  try {
    const log = createLogger("my-fn");
    log.info("hello", { foo: "bar" });
    const parsed = cap.parsed();
    assertEquals(parsed.length, 1);
    assertEquals(parsed[0].level, "info");
    assertEquals(parsed[0].fn, "my-fn");
    assertEquals(parsed[0].msg, "hello");
    assertEquals(parsed[0].foo, "bar");
    assert(typeof parsed[0].ts === "string");
    assert(typeof parsed[0].rid === "string");
    assertEquals((parsed[0].rid as string).length, 8);
  } finally {
    cap.restore();
  }
});

Deno.test("createLogger.warn / error — route to console.warn / console.error", () => {
  const cap = captureConsole();
  try {
    const log = createLogger("fn");
    log.warn("careful");
    log.error("boom");
    assertEquals(cap.entries.length, 2);
    assertEquals(cap.entries[0].level, "warn");
    assertEquals(cap.entries[1].level, "error");
  } finally {
    cap.restore();
  }
});

Deno.test("createLogger — marks userId 'pending' when Authorization Bearer header is present", () => {
  const cap = captureConsole();
  try {
    const req = new Request("https://x.test/f", { headers: { Authorization: "Bearer tok" } });
    const log = createLogger("fn", req);
    log.info("auth'd");
    const parsed = cap.parsed();
    assertEquals(parsed[0].uid, "pending");
  } finally {
    cap.restore();
  }
});

Deno.test("createLogger — leaves uid null when no Authorization header", () => {
  const cap = captureConsole();
  try {
    const log = createLogger("fn", new Request("https://x.test/f"));
    log.info("anon");
    const parsed = cap.parsed();
    assertEquals(parsed[0].uid, null);
  } finally {
    cap.restore();
  }
});

Deno.test("createLogger.withUser — attaches user id to subsequent log lines", () => {
  const cap = captureConsole();
  try {
    const log = createLogger("fn");
    log.info("before"); // uid should be null
    const withUser = log.withUser("user-123");
    withUser.info("after"); // uid should be user-123
    const parsed = cap.parsed();
    assertEquals(parsed[0].uid, null);
    assertEquals(parsed[1].uid, "user-123");
  } finally {
    cap.restore();
  }
});

Deno.test("withLogging — wraps a success response with start + completed lines", async () => {
  const cap = captureConsole();
  try {
    const wrapped = withLogging("fn", async () => new Response("ok", { status: 200 }));
    const res = await wrapped(new Request("https://x.test/f", { method: "POST" }));
    assertEquals(res.status, 200);
    const parsed = cap.parsed();
    assertEquals(parsed[0].msg, "Request started");
    assertEquals(parsed[0].method, "POST");
    assertEquals(parsed[1].msg, "Request completed");
    assertEquals(parsed[1].status, 200);
    assert(typeof parsed[1].durationMs === "number");
  } finally {
    cap.restore();
  }
});

Deno.test("withLogging — logs the failure and re-throws when handler errors", async () => {
  const cap = captureConsole();
  try {
    const wrapped = withLogging("fn", async () => {
      throw new Error("boom");
    });
    let caught: unknown;
    try {
      await wrapped(new Request("https://x.test/f"));
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof Error);
    assertEquals((caught as Error).message, "boom");
    const parsed = cap.parsed();
    const failure = parsed.find((p) => p.msg === "Request failed");
    assert(failure !== undefined);
    assertEquals(failure!.error, "boom");
    assert(typeof failure!.durationMs === "number");
  } finally {
    cap.restore();
  }
});
