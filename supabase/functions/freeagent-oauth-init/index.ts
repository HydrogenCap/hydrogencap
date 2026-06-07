// Issues a CSRF-protected FreeAgent OAuth state by persisting a nonce server-side.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withInvocationLog } from "../_shared/logger.ts";

const ALLOWED_ORIGINS = [
  "https://tenureiq.com",
  "https://www.tenureiq.com",
  "https://hydrogencapital.lovable.app",
  Deno.env.get("ALLOWED_ORIGIN"),
].filter(Boolean) as string[];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(withInvocationLog("freeagent-oauth-init", async (req, _log) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const orgId = typeof body?.orgId === "string" ? body.orgId : null;
    const entityId = typeof body?.entityId === "string" ? body.entityId : null;
    const companyId = typeof body?.companyId === "string" ? body.companyId : null;
    const useSandbox = body?.useSandbox === true;

    if (!orgId) {
      return new Response(JSON.stringify({ error: "orgId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is an owner/admin in the target org
    const { data: membership } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate cryptographically random nonce, persist server-side
    const nonce = crypto.randomUUID() + crypto.randomUUID();
    const { error: insertError } = await supabase.from("oauth_states").insert({
      nonce,
      user_id: user.id,
      org_id: orgId,
      provider: "freeagent",
      payload: { entityId, companyId, useSandbox },
    });

    if (insertError) {
      console.error("oauth_states insert failed:", insertError.message);
      return new Response(JSON.stringify({ error: "Failed to init OAuth" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Opportunistic cleanup of expired states
    await supabase.from("oauth_states").delete().lt("expires_at", new Date().toISOString());

    const state = btoa(JSON.stringify({
      entityId, companyId, orgId, userId: user.id, useSandbox, nonce,
    }));

    return new Response(JSON.stringify({ state }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("freeagent-oauth-init error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
}));
