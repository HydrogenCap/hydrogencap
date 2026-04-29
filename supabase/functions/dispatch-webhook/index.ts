import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

import { withInvocationLog } from "../_shared/logger.ts";
serve(withInvocationLog("dispatch-webhook", async (req: Request, _invocationLog) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { event_type, payload, org_id } = await req.json();

    if (!event_type || !payload || !org_id) {
      return new Response(
        JSON.stringify({ error: "event_type, payload, and org_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller is a member of the org whose webhooks they're dispatching.
    // Without this, any authenticated user could dispatch webhooks for any org and
    // leak data / forge signed events to third-party systems.
    // Also restrict to roles that should be allowed to fire webhooks — viewers
    // and accountants shouldn't be able to ship arbitrary payloads to any
    // configured third-party endpoint.
    const { data: membership } = await supabase
      .from("memberships")
      .select("role")
      .eq("org_id", org_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Forbidden: not a member of this org" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const WEBHOOK_DISPATCH_ROLES = new Set(["owner", "admin", "member"]);
    if (!WEBHOOK_DISPATCH_ROLES.has(membership.role)) {
      return new Response(
        JSON.stringify({ error: "Forbidden: insufficient role to dispatch webhooks" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find active endpoints subscribed to this event
    const { data: endpoints, error: epError } = await supabase
      .from("webhook_endpoints")
      .select("*")
      .eq("org_id", org_id)
      .eq("is_active", true)
      .contains("events", [event_type]);

    if (epError) throw epError;

    if (!endpoints || endpoints.length === 0) {
      return new Response(
        JSON.stringify({ dispatched: 0, message: "No active endpoints for this event" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = await Promise.allSettled(
      endpoints.map(async (endpoint: any) => {
        const deliveryId = crypto.randomUUID();
        const body = JSON.stringify(payload);

        // HMAC-SHA256 signature
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw",
          encoder.encode(endpoint.secret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );
        const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
        const signature = Array.from(new Uint8Array(signatureBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        let responseStatus: number | null = null;
        let responseBody: string | null = null;
        let status = "failed";
        let deliveredAt: string | null = null;

        try {
          const response = await fetch(endpoint.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-TenureIQ-Signature": `sha256=${signature}`,
              "X-TenureIQ-Event": event_type,
              "X-TenureIQ-Delivery-ID": deliveryId,
            },
            body,
          });

          responseStatus = response.status;
          responseBody = await response.text().catch(() => null);

          if (response.ok) {
            status = "delivered";
            deliveredAt = new Date().toISOString();
          }
        } catch (fetchErr) {
          responseBody = fetchErr instanceof Error ? fetchErr.message : "Network error";
        }

        // Record delivery
        await supabase.from("webhook_deliveries").insert({
          id: deliveryId,
          endpoint_id: endpoint.id,
          event_type,
          payload,
          response_status: responseStatus,
          response_body: responseBody,
          attempt_count: 1,
          status,
          delivered_at: deliveredAt,
        });

        return { endpoint_id: endpoint.id, status, response_status: responseStatus };
      })
    );

    const dispatched = results.filter((r) => r.status === "fulfilled").length;

    return new Response(
      JSON.stringify({ dispatched, results: results.map((r) => r.status === "fulfilled" ? r.value : { error: String(r.reason) }) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[DISPATCH-WEBHOOK]", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: message === "Unauthorized" ? 401 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
