/**
 * Properties §0b Ship A invariant — bulk-price-paid-enrich must NOT write to
 * the V1 `properties` table. Reads (`.select(...)`) are still allowed and
 * will be redirected to `properties_v2` in Ship C.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SOURCE_PATH = new URL("./index.ts", import.meta.url);

const BANNED = /\.from\(\s*['"]properties['"]\s*\)\s*\.\s*(insert|update|upsert|delete)\b/;

Deno.test("bulk-price-paid-enrich does not write to V1 properties", async () => {
  const source = await Deno.readTextFile(SOURCE_PATH);
  const collapsed = source.replace(/\s+/g, " ");
  const offender = collapsed.match(BANNED);
  assertEquals(
    offender,
    null,
    `bulk-price-paid-enrich must not call properties.(insert|update|upsert|delete). ` +
      `Found: ${offender?.[0]}`,
  );
});
