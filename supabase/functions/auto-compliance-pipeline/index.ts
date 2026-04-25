import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { authorizeRequest, buildCorsHeaders, runAutoCompliancePipeline } from "./pipeline.ts";

const ALLOWED_ORIGINS = [
  "https://tenureiq.com",
  "https://www.tenureiq.com",
  "https://hydrogencapital.lovable.app",
  Deno.env.get("ALLOWED_ORIGIN"),
].filter(Boolean) as string[];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const authorization = await authorizeRequest(req, supabase, Deno.env.get("CRON_SECRET"));

    console.log("Starting auto-compliance-pipeline scan");
    const result = await runAutoCompliancePipeline(supabase, authorization);
    console.log(
      `Pipeline complete: ${result.tasks_created} tasks created, ${result.contractors_assigned} contractors assigned, ${result.notifications_sent} notifications, ${result.requests_sent} requests sent, ${result.priorities_updated} priorities updated`,
    );

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in auto-compliance-pipeline:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    const status = msg === "Unauthorized" ? 401 : msg === "Access denied" ? 403 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
