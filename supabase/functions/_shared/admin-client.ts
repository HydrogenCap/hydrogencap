// Shared admin (service-role) Supabase client for edge functions.
//
// Edge functions cannot import from `src/` so the `Database` generic from
// `src/integrations/supabase/types.ts` is unavailable here. We expose the
// permissive `SupabaseClient` (default generics) instead — same trade-off
// the previously per-site `as unknown as ReturnType<typeof createClient>`
// casts were already making, now codified in one place.
//
// Test code may inject a structural stub via `AdminSupabaseLike` (mirrors
// the `RateLimitSupabaseLike` precedent in `_shared/rateLimit.ts`).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Bare `SupabaseClient` defaults to `<any, "public", any>` — assignable from
// both anon-key user clients and service-role admin clients without casts.
// deno-lint-ignore no-explicit-any
export type AdminSupabaseClient = SupabaseClient<any, "public", any>;

// deno-lint-ignore no-explicit-any
export type AdminSupabaseLike = { from: (table: string) => any; auth?: any; storage?: any };

/**
 * Build a service-role Supabase client. Reads SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY from the environment. Throws synchronously if
 * either is missing so callers fail loudly at boot.
 */
export function getAdminClient(): AdminSupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("getAdminClient: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
