// Structural supabase-client type — the real client satisfies it and tests
// can pass a lightweight stub with `.from()`.
// deno-lint-ignore no-explicit-any
export type SubscriptionSupabaseLike = { from: (table: string) => any };

/**
 * Check whether the given user has access to an active subscription.
 *
 * The `subscriptions` table is keyed by `user_id` (typically the org owner
 * who set up Stripe). Team members (non-owner members of an org) don't have
 * their own row but should still be able to use paid features as long as
 * the org they belong to has a paying owner.
 *
 * Resolution order:
 *   1. Direct subscription against this user (original behaviour).
 *   2. Any org they are a member of has another member with an active sub.
 */
export async function requireActiveSubscription(
  userId: string,
  corsHeaders: Record<string, string>,
  supabaseAdminOverride?: SubscriptionSupabaseLike
): Promise<{ allowed: true } | { allowed: false; response: Response }> {
  // Lazy-load the real client only when no override is supplied so tests can
  // inject a fake without triggering an esm.sh fetch.
  const supabaseAdmin: SubscriptionSupabaseLike = supabaseAdminOverride ?? await (async () => {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
    return createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  })();

  // 1. User has their own subscription row.
  const { data: ownSub } = await supabaseAdmin
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .maybeSingle();

  if (ownSub) return { allowed: true };

  // 2. Team member — is any peer in their org(s) on an active subscription?
  const { data: memberships } = await supabaseAdmin
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId);

  const orgIds = (memberships ?? []).map((m: { org_id: string }) => m.org_id);

  if (orgIds.length > 0) {
    const { data: peers } = await supabaseAdmin
      .from("memberships")
      .select("user_id")
      .in("org_id", orgIds);

    const peerIds = Array.from(
      new Set((peers ?? []).map((p: { user_id: string }) => p.user_id))
    ).filter((id) => id !== userId);

    if (peerIds.length > 0) {
      const { data: peerSub } = await supabaseAdmin
        .from("subscriptions")
        .select("status")
        .in("user_id", peerIds)
        .in("status", ["active", "trialing"])
        .limit(1)
        .maybeSingle();

      if (peerSub) return { allowed: true };
    }
  }

  return {
    allowed: false,
    response: new Response(
      JSON.stringify({ error: "Active subscription required" }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    ),
  };
}
