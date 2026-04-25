// Structural supabase-client type — the real `SupabaseClient<Database>` from
// supabase-js satisfies this, and a test stub with `.from()` does too.
// deno-lint-ignore no-explicit-any
export type RateLimitSupabaseLike = { from: (table: string) => any };

/**
 * Rate limiter using the rate_limits table.
 *
 * Supports per-user and per-org limits. When an `orgId` is supplied we also
 * enforce an org-wide cap — otherwise a 50-seat team hits the per-user limit
 * 50x in parallel and exhausts AI credits / external API quotas.
 *
 * Fails closed — if the check itself errors, the request is denied.
 */
export async function checkRateLimit(
  userId: string,
  functionName: string,
  maxRequests: number = 20,
  windowMinutes: number = 60,
  options?: { orgId?: string | null; orgMax?: number; supabase?: RateLimitSupabaseLike }
): Promise<{ allowed: boolean; remaining: number; resetAt: string }> {
  try {
    // Lazy-load the real client only when no override is supplied. This keeps
    // tests (which inject a fake) free of any esm.sh / network dependency.
    const supabase: RateLimitSupabaseLike = options?.supabase ?? await (async () => {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
      return createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
    })();

    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    // Per-user check
    const { count, error } = await supabase
      .from("rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("function_name", functionName)
      .gte("created_at", windowStart);

    if (error) {
      console.error("Rate limit check failed:", error);
      return { allowed: false, remaining: 0, resetAt: new Date(Date.now() + 60_000).toISOString() };
    }

    const used = count ?? 0;
    const remaining = Math.max(0, maxRequests - used);

    if (used >= maxRequests) {
      const resetAt = new Date(Date.now() + windowMinutes * 60 * 1000).toISOString();
      return { allowed: false, remaining: 0, resetAt };
    }

    // Per-org check (only if caller supplied an org id and an org-level cap).
    // Defaults to 10x the per-user cap if no explicit orgMax is provided.
    if (options?.orgId) {
      const orgMax = options.orgMax ?? maxRequests * 10;
      const { count: orgCount, error: orgErr } = await supabase
        .from("rate_limits")
        .select("id", { count: "exact", head: true })
        .eq("org_id", options.orgId)
        .eq("function_name", functionName)
        .gte("created_at", windowStart);

      if (orgErr) {
        console.error("Rate limit org check failed:", orgErr);
        return { allowed: false, remaining: 0, resetAt: new Date(Date.now() + 60_000).toISOString() };
      }

      if ((orgCount ?? 0) >= orgMax) {
        const resetAt = new Date(Date.now() + windowMinutes * 60 * 1000).toISOString();
        return { allowed: false, remaining: 0, resetAt };
      }
    }

    // Record this request
    await supabase
      .from("rate_limits")
      .insert({ user_id: userId, function_name: functionName, org_id: options?.orgId ?? null });

    return { allowed: true, remaining: remaining - 1, resetAt: "" };
  } catch (err) {
    console.error("Rate limit error:", err);
    // Fail closed — deny request if rate limit check fails
    return { allowed: false, remaining: 0, resetAt: new Date(Date.now() + 60_000).toISOString() };
  }
}

/**
 * Build a 429 response for rate-limited requests.
 */
export function rateLimitResponse(
  corsHeaders: Record<string, string>,
  remaining: number,
  resetAt: string
): Response {
  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      message: "You've reached the maximum number of requests. Please try again later.",
      remaining,
      resetAt,
    }),
    {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
