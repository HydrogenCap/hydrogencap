import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export async function requireActiveSubscription(
  userId: string,
  corsHeaders: Record<string, string>
): Promise<{ allowed: true } | { allowed: false; response: Response }> {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .maybeSingle();

  if (!data) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({ error: "Active subscription required" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }
  return { allowed: true };
}
