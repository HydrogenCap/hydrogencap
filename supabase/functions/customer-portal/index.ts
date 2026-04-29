import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, isAllowedOrigin } from "../_shared/cors.ts";
import { handleCustomerPortal } from "./handler.ts";

import { withInvocationLog } from "../_shared/logger.ts";
const DEFAULT_BILLING_ORIGIN = "https://tenureiq.com";

serve(withInvocationLog("customer-portal", async (req, log) => {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  return handleCustomerPortal(req, {
    supabase,
    stripe,
    corsHeaders: getCorsHeaders(req),
    isAllowedOrigin,
    defaultBillingOrigin: DEFAULT_BILLING_ORIGIN,
  });
}));
