/**
 * §0b Ship A invariant — process-document edge function MUST NOT write to
 * the V1 `compliance_items` or `compliance_documents` tables. Reads
 * (`.select(...)`) are still permitted and will be redirected via a compat
 * layer in §0b Ship C/D.
 *
 * Static source-text check: opening the file and asserting no banned
 * write patterns appear. This avoids spinning up a real edge runtime
 * + supabase admin client, and matches the style of the CI grep guard.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SOURCE_PATH = new URL("./index.ts", import.meta.url);

const BANNED_PATTERNS: RegExp[] = [
  /\.from\(\s*['"]compliance_items['"]\s*\)\s*\.\s*(insert|update|upsert|delete)\b/,
  /\.from\(\s*['"]compliance_documents['"]\s*\)\s*\.\s*(insert|update|upsert|delete)\b/,
];

Deno.test("process-document does not write to V1 compliance_items", async () => {
  const source = await Deno.readTextFile(SOURCE_PATH);
  // Strip the chained call that may span lines: collapse whitespace.
  const collapsed = source.replace(/\s+/g, " ");
  const offenders = collapsed.match(BANNED_PATTERNS[0]);
  assertEquals(
    offenders,
    null,
    `process-document must not call compliance_items.(insert|update|upsert|delete). ` +
      `Found: ${offenders?.[0]}`,
  );
});

Deno.test("process-document does not write to V1 compliance_documents", async () => {
  const source = await Deno.readTextFile(SOURCE_PATH);
  const collapsed = source.replace(/\s+/g, " ");
  const offenders = collapsed.match(BANNED_PATTERNS[1]);
  assertEquals(
    offenders,
    null,
    `process-document must not call compliance_documents.(insert|update|upsert|delete). ` +
      `Found: ${offenders?.[0]}`,
  );
});

Deno.test("process-document still writes the V2 compliance_documents_v2 record", async () => {
  const source = await Deno.readTextFile(SOURCE_PATH);
  const hasV2Insert =
    /\.from\(\s*['"]compliance_documents_v2['"]\s*\)\s*\.\s*insert\b/.test(
      source.replace(/\s+/g, " "),
    );
  assertEquals(hasV2Insert, true, "process-document should still insert into compliance_documents_v2");
});

Deno.test("process-document does not write to V1 properties (Properties §0b Ship A)", async () => {
  const source = await Deno.readTextFile(SOURCE_PATH);
  const collapsed = source.replace(/\s+/g, " ");
  const offender = collapsed.match(
    /\.from\(\s*['"]properties['"]\s*\)\s*\.\s*(insert|update|upsert|delete)\b/,
  );
  assertEquals(
    offender,
    null,
    `process-document must not call properties.(insert|update|upsert|delete). Found: ${offender?.[0]}`,
  );
});
