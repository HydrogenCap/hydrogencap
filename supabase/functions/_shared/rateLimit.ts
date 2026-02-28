import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Simple per-user rate limiter using the rate_limits table.
 * Fails open — if the check itself errors, the request is allowed.
 */
export async function checkRateLimit(
  userId: string,
  functionName: string,
  maxRequests: number = 20,
  windowMinutes: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: string }> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    const { count, error } = await supabase
      .from("rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("function_name", functionName)
      .gte("created_at", windowStart);

    if (error) {
      console.error("Rate limit check failed:", error);
      return { allowed: true, remaining: maxRequests, resetAt: "" };
    }

    const used = count ?? 0;
    const remaining = Math.max(0, maxRequests - used);

    if (used >= maxRequests) {
      const resetAt = new Date(Date.now() + windowMinutes * 60 * 1000).toISOString();
      return { allowed: false, remaining: 0, resetAt };
    }

    // Record this request
    await supabase
      .from("rate_limits")
      .insert({ user_id: userId, function_name: functionName });

    return { allowed: true, remaining: remaining - 1, resetAt: "" };
  } catch (err) {
    console.error("Rate limit error:", err);
    // Fail open
    return { allowed: true, remaining: maxRequests, resetAt: "" };
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
