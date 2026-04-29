import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

import { withInvocationLog } from "../_shared/logger.ts";
serve(withInvocationLog("delete-account", async (req, _invocationLog) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: authError } = await userSupabase.auth.getUser();
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Block deletion if user is the sole owner of any org
    const { data: ownedOrgs } = await supabaseAdmin
      .from("memberships")
      .select("org_id")
      .eq("user_id", userId)
      .eq("role", "owner");

    if (ownedOrgs && ownedOrgs.length > 0) {
      for (const { org_id } of ownedOrgs) {
        const { count } = await supabaseAdmin
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org_id)
          .eq("role", "owner");

        if (count === 1) {
          return new Response(
            JSON.stringify({
              error: "You are the sole owner of one or more organisations. Transfer ownership or close the organisation before deleting your account.",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Remove from memberships
    await supabaseAdmin.from("memberships").delete().eq("user_id", userId);

    // Anonymise PII in profiles
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: null, avatar_url: null })
      .eq("id", userId);

    // Delete the auth user record
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      throw deleteError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("delete-account error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
