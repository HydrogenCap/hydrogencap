// Initiates a FreeAgent OAuth flow with an HMAC-signed state token + replay-protected nonce.
// Requires an authenticated user. Returns { authUrl } pointing at FreeAgent's approve_app endpoint.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { signState } from "../_shared/oauthState.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const FREEAGENT_CLIENT_ID = Deno.env.get("FREEAGENT_CLIENT_ID")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }

    // Verify the caller via their JWT.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const { entityId, companyId, orgId, useSandbox } = body ?? {};
    if (!orgId || typeof orgId !== "string") {
      return json({ error: "orgId is required" }, 400);
    }
    if (!entityId && !companyId) {
      return json({ error: "entityId or companyId is required" }, 400);
    }

    // Service-role client for membership check + nonce insert.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Caller must be owner/admin of the org.
    const { data: membership } = await admin
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("org_id", orgId)
      .in("role", ["owner", "admin"])
      .maybeSingle();
    if (!membership) return json({ error: "forbidden" }, 403);

    const nonce = crypto.randomUUID();
    const exp = Date.now() + 10 * 60 * 1000; // 10 minutes

    const payload = {
      orgId,
      userId,
      entityId: entityId || undefined,
      companyId: companyId || undefined,
      useSandbox: !!useSandbox,
      nonce,
      exp,
    };

    const state = await signState(payload);

    const { error: insertErr } = await admin
      .from("oauth_states")
      .insert({ nonce, used_at: null });
    if (insertErr) {
      console.error("oauth_states insert failed", insertErr.message);
      return json({ error: "state_persist_failed" }, 500);
    }

    const apiBase = useSandbox
      ? "https://api.sandbox.freeagent.com"
      : "https://api.freeagent.com";
    const redirectUri = `${SUPABASE_URL}/functions/v1/freeagent-oauth-callback`;
    const params = new URLSearchParams({
      response_type: "code",
      client_id: FREEAGENT_CLIENT_ID,
      redirect_uri: redirectUri,
      state,
    });
    const authUrl = `${apiBase}/v2/approve_app?${params.toString()}`;

    return json({ authUrl });
  } catch (err: any) {
    console.error("freeagent-oauth-init error", err?.message || err);
    return json({ error: "unexpected", message: err?.message || String(err) }, 500);
  }
});
