import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import { handleCompaniesHouseLookup } from "./handler.ts";

import { withInvocationLog } from "../_shared/logger.ts";
serve(withInvocationLog("companies-house-lookup", async (req, log) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  return handleCompaniesHouseLookup(req, {
    supabase,
    fetch,
    corsHeaders: getCorsHeaders(req),
    apiKey: Deno.env.get("COMPANIES_HOUSE_API_KEY")?.trim(),
  });
}));
