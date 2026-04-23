import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, isAllowedOrigin } from "../_shared/cors.ts";
import { handleCreateCheckout } from "./handler.ts";

const DEFAULT_BILLING_ORIGIN = "https://tenureiq.com";
const ALLOWED_PRICE_IDS = new Set([
  "price_1SzP0MAZFDMuITvQvU1ICh4p",
  "price_1SzP1KAZFDMuITvQ4pZv6t5R",
  "price_1SzP1aAZFDMuITvQsijsXgos",
]);

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  return handleCreateCheckout(req, {
    supabase,
    stripe,
    corsHeaders: getCorsHeaders(req),
    isAllowedOrigin,
    allowedPriceIds: ALLOWED_PRICE_IDS,
    defaultBillingOrigin: DEFAULT_BILLING_ORIGIN,
  });
});
