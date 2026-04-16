import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

serve(async (req) => {
  // Webhooks are POST only — no CORS needed (server-to-server)
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeKey || !webhookSecret) {
      console.error("[STRIPE-WEBHOOK] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
      return new Response("Server configuration error", { status: 500 });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("[STRIPE-WEBHOOK] Missing stripe-signature header");
      return new Response("Missing signature", { status: 400 });
    }

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown signature verification error";
      console.error("[STRIPE-WEBHOOK] Signature verification failed:", errorMessage);
      return new Response(`Webhook signature verification failed: ${errorMessage}`, { status: 400 });
    }

    console.log(`[STRIPE-WEBHOOK] Received event: ${event.type} (${event.id})`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Handle relevant subscription events
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.customer_email) {
          console.log(`[STRIPE-WEBHOOK] Checkout completed for ${session.customer_email}`);
          await syncSubscriptionByEmail(stripe, supabase, session.customer_email);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted && customer.email) {
          console.log(`[STRIPE-WEBHOOK] Subscription ${event.type} for ${customer.email}`);
          await syncSubscriptionByEmail(stripe, supabase, customer.email);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted && customer.email) {
          console.log(`[STRIPE-WEBHOOK] Payment failed for ${customer.email}`);
          await syncSubscriptionByEmail(stripe, supabase, customer.email, "payment_failed");
        }
        break;
      }

      default:
        console.log(`[STRIPE-WEBHOOK] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[STRIPE-WEBHOOK] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

/**
 * Sync subscription status from Stripe to the subscriptions table.
 */
async function syncSubscriptionByEmail(
  stripe: Stripe,
  supabase: any,
  email: string,
  overrideStatus?: string
) {
  let userId: string | undefined;

  // 1. Try an existing subscriptions row keyed by the Stripe customer id.
  //    This is the fastest and scales to unlimited users.
  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    const stripeCustomerId = customers.data[0]?.id;
    if (stripeCustomerId) {
      const { data: existing } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_customer_id", stripeCustomerId)
        .limit(1)
        .maybeSingle();
      if (existing?.user_id) userId = existing.user_id;
    }
  } catch (err) {
    console.warn("[STRIPE-WEBHOOK] stripe_customer_id lookup failed:", err);
  }

  // 2. Fall back to the profiles table (keyed by email).
  if (!userId) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .limit(1);

    const typedProfiles = (profiles || []) as Array<{ user_id: string | null }>;
    if (typedProfiles.length && typedProfiles[0].user_id) {
      userId = typedProfiles[0].user_id;
    }
  }

  // 3. Last resort — page through auth.users. listUsers() defaults to the
  //    first 50 and caps at 1000 per page, so a naive call silently fails
  //    once the workspace grows past that. Page until we find the email or
  //    exhaust all users.
  if (!userId) {
    const PAGE_SIZE = 1000;
    for (let page = 1; page <= 50; page++) {
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
      if (listError) {
        console.error("[STRIPE-WEBHOOK] listUsers error:", listError);
        break;
      }
      const users = listData?.users ?? [];
      const match = users.find((u: { email?: string | null }) => u.email === email);
      if (match) { userId = match.id; break; }
      if (users.length < PAGE_SIZE) break; // last page
    }
  }

  if (!userId) {
    console.error(`[STRIPE-WEBHOOK] No user found for email: ${email}`);
    return;
  }

  await upsertSubscription(stripe, supabase, userId, email, overrideStatus);
}

async function upsertSubscription(
  stripe: Stripe,
  supabase: any,
  userId: string,
  email: string,
  overrideStatus?: string
) {
  // Get active subscription from Stripe
  const customers = await stripe.customers.list({ email, limit: 1 });
  if (!customers.data.length) return;

  const subscriptions = await stripe.subscriptions.list({
    customer: customers.data[0].id,
    limit: 1,
  });

  const sub = subscriptions.data[0];

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customers.data[0].id,
      stripe_subscription_id: sub?.id || null,
      status: overrideStatus || sub?.status || "inactive",
      product_id: (sub?.items?.data?.[0]?.price?.product as string) || null,
      price_id: sub?.items?.data?.[0]?.price?.id || null,
      current_period_end: sub
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error(`[STRIPE-WEBHOOK] Failed to upsert subscription for ${userId}:`, error);
  } else {
    console.log(`[STRIPE-WEBHOOK] Subscription synced for ${userId}: ${sub?.status || "inactive"}`);
  }
}
