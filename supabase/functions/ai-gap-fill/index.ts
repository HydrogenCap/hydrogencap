import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireActiveSubscription } from "../_shared/checkSubscription.ts";
import { handleAiGapFill } from "./handler.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const authHeader = req.headers.get("Authorization") ?? "";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  return handleAiGapFill(req, {
    supabase,
    checkRateLimit: (userId, fn, max, win) => checkRateLimit(userId, fn, max, win),
    rateLimitResponse,
    requireActiveSubscription,
    fetch,
    corsHeaders,
    lovableApiKey: Deno.env.get("LOVABLE_API_KEY"),
  });
});
