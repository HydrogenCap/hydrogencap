/**
 * Unit tests for the CORS helper. Run with:
 *
 *   deno test supabase/functions/_shared/cors.test.ts --allow-env
 *
 * Uses zero external imports so tests run offline on a fresh Deno install.
 */
import { getCorsHeaders, isAllowedOrigin } from "./cors.ts";

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) {
    throw new Error(msg ?? `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.test("isAllowedOrigin — accepts production hostnames", () => {
  assert(isAllowedOrigin("https://tenureiq.com"));
  assert(isAllowedOrigin("https://www.tenureiq.com"));
  assert(isAllowedOrigin("https://hydrogencapital.lovable.app"));
});

Deno.test("isAllowedOrigin — accepts Lovable project preview subdomains", () => {
  assert(isAllowedOrigin("https://abc123.lovableproject.com"));
  assert(isAllowedOrigin("https://my-project-9f8d7c6b.lovableproject.com"));
});

Deno.test("isAllowedOrigin — accepts Lovable branch preview subdomains", () => {
  assert(isAllowedOrigin("https://branch-name-preview--project-id.lovable.app"));
});

Deno.test("isAllowedOrigin — rejects HTTP origins for production hostnames", () => {
  assert(!isAllowedOrigin("http://tenureiq.com"));
});

Deno.test("isAllowedOrigin — rejects arbitrary third-party origins", () => {
  assert(!isAllowedOrigin("https://evil.example.com"));
  assert(!isAllowedOrigin("https://tenureiq.com.evil.com"));
});

Deno.test("isAllowedOrigin — rejects empty origin", () => {
  assert(!isAllowedOrigin(""));
});

Deno.test("getCorsHeaders — echoes the request origin when allowed", () => {
  const req = new Request("https://api.example.com/fn", {
    headers: { Origin: "https://tenureiq.com" },
  });
  const headers = getCorsHeaders(req);
  assertEquals(headers["Access-Control-Allow-Origin"], "https://tenureiq.com");
});

Deno.test("getCorsHeaders — falls back to the first static origin when not allowed", () => {
  const req = new Request("https://api.example.com/fn", {
    headers: { Origin: "https://evil.example.com" },
  });
  const headers = getCorsHeaders(req);
  assertEquals(headers["Access-Control-Allow-Origin"], "https://tenureiq.com");
});

Deno.test("getCorsHeaders — falls back when there's no Origin header", () => {
  const req = new Request("https://api.example.com/fn");
  const headers = getCorsHeaders(req);
  assertEquals(headers["Access-Control-Allow-Origin"], "https://tenureiq.com");
});

Deno.test("getCorsHeaders — declares the supported methods and custom headers", () => {
  const req = new Request("https://api.example.com/fn", {
    headers: { Origin: "https://tenureiq.com" },
  });
  const headers = getCorsHeaders(req);
  assertEquals(headers["Access-Control-Allow-Methods"], "GET, POST, OPTIONS");
  assert(headers["Access-Control-Allow-Headers"].includes("authorization"));
  assert(headers["Access-Control-Allow-Headers"].includes("apikey"));
  assert(headers["Access-Control-Allow-Headers"].includes("content-type"));
  assert(headers["Access-Control-Allow-Headers"].includes("x-supabase-client-platform"));
});
