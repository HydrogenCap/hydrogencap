/**
 * Testable webhook handler — pure logic, no top-level network imports.
 *
 * `index.ts` owns the serve() entrypoint and constructs the real Stripe /
 * Supabase clients from env vars, then calls `handleStripeWebhook` with
 * them injected. Tests import this file directly and pass fakes — they
 * don't trigger any esm.sh fetch.
 *
 * Structural types capture only the Stripe surface we touch, so
 * callers can pass the real SDK client (it satisfies the interface) or
 * a test stub.
 */

// ─── Structural Stripe types ─────────────────────────────────────────

export interface StripeEvent {
  type: string;
  id: string;
  data: { object: unknown };
}

export interface StripeCustomer {
  id: string;
  email?: string | null;
  deleted?: boolean;
}

export interface StripeCheckoutSession {
  mode: string;
  customer_email?: string | null;
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_end: number;
  items: { data: Array<{ price: { id: string; product: string | { id: string } } }> };
}

export interface StripeInvoice {
  customer: string;
}

export interface StripeLike {
  webhooks: {
    constructEventAsync: (body: string, signature: string, secret: string) => Promise<StripeEvent>;
  };
  customers: {
    list: (params: { email: string; limit: number }) => Promise<{ data: StripeCustomer[] }>;
    retrieve: (id: string) => Promise<StripeCustomer>;
  };
  subscriptions: {
    list: (params: { customer: string; limit: number }) => Promise<{ data: StripeSubscription[] }>;
  };
}

// ─── Structural Supabase admin client ────────────────────────────────

// deno-lint-ignore no-explicit-any
export type SupabaseAdminLike = {
  // deno-lint-ignore no-explicit-any
  from: (table: string) => any;
  auth: {
    admin: {
      listUsers: (opts: { page: number; perPage: number }) => Promise<{
        data?: { users?: Array<{ id: string; email?: string | null }> };
        error?: { message: string } | null;
      }>;
    };
  };
};

export interface HandleWebhookDeps {
  stripe: StripeLike;
  supabase: SupabaseAdminLike;
  webhookSecret: string;
}

// ─── Webhook handler ─────────────────────────────────────────────────

export async function handleStripeWebhook(
  req: Request,
  deps: HandleWebhookDeps,
): Promise<Response> {
  // Webhooks are POST-only — no CORS needed (server-to-server).
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("[STRIPE-WEBHOOK] Missing stripe-signature header");
      return new Response("Missing signature", { status: 400 });
    }

    // Verify the webhook signature.
    let event: StripeEvent;
    try {
      event = await deps.stripe.webhooks.constructEventAsync(body, signature, deps.webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown signature verification error";
      console.error("[STRIPE-WEBHOOK] Signature verification failed:", errorMessage);
      return new Response(`Webhook signature verification failed: ${errorMessage}`, { status: 400 });
    }

    console.log(`[STRIPE-WEBHOOK] Received event: ${event.type} (${event.id})`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as StripeCheckoutSession;
        if (session.mode === "subscription" && session.customer_email) {
          console.log(`[STRIPE-WEBHOOK] Checkout completed for ${session.customer_email}`);
          await syncSubscriptionByEmail(deps.stripe, deps.supabase, session.customer_email);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as StripeSubscription;
        const customerId = subscription.customer;
        const customer = await deps.stripe.customers.retrieve(customerId);
        if (!customer.deleted && customer.email) {
          console.log(`[STRIPE-WEBHOOK] Subscription ${event.type} for ${customer.email}`);
          await syncSubscriptionByEmail(deps.stripe, deps.supabase, customer.email);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as StripeInvoice;
        const customerId = invoice.customer;
        const customer = await deps.stripe.customers.retrieve(customerId);
        if (!customer.deleted && customer.email) {
          console.log(`[STRIPE-WEBHOOK] Payment failed for ${customer.email}`);
          await syncSubscriptionByEmail(deps.stripe, deps.supabase, customer.email, "payment_failed");
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
}

/**
 * Resolve a Stripe email to a Supabase user id, then upsert the subscription.
 *
 * Resolution order:
 *   1. Existing subscriptions row keyed by Stripe customer id (fastest).
 *   2. profiles table (keyed by email).
 *   3. Paginated scan of auth.users (last resort).
 */
export async function syncSubscriptionByEmail(
  stripe: StripeLike,
  supabase: SupabaseAdminLike,
  email: string,
  overrideStatus?: string,
): Promise<void> {
  let userId: string | undefined;

  // 1. Existing subscriptions row by Stripe customer id.
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

  // 2. profiles fallback.
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

  // 3. auth.users pagination.
  if (!userId) {
    const PAGE_SIZE = 1000;
    for (let page = 1; page <= 50; page++) {
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
      if (listError) {
        console.error("[STRIPE-WEBHOOK] listUsers error:", listError);
        break;
      }
      const users = listData?.users ?? [];
      const match = users.find((u) => u.email === email);
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

export async function upsertSubscription(
  stripe: StripeLike,
  supabase: SupabaseAdminLike,
  userId: string,
  email: string,
  overrideStatus?: string,
): Promise<void> {
  const customers = await stripe.customers.list({ email, limit: 1 });
  if (!customers.data.length) return;

  const subscriptions = await stripe.subscriptions.list({
    customer: customers.data[0].id,
    limit: 1,
  });

  const sub = subscriptions.data[0];

  // price.product in the real Stripe SDK can be an id string OR an expanded
  // Product object; support both.
  const product = sub?.items?.data?.[0]?.price?.product;
  const productId = typeof product === "string" ? product : product?.id ?? null;

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customers.data[0].id,
      stripe_subscription_id: sub?.id || null,
      status: overrideStatus || sub?.status || "inactive",
      product_id: productId,
      price_id: sub?.items?.data?.[0]?.price?.id || null,
      current_period_end: sub
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error(`[STRIPE-WEBHOOK] Failed to upsert subscription for ${userId}:`, error);
  } else {
    console.log(`[STRIPE-WEBHOOK] Subscription synced for ${userId}: ${sub?.status || "inactive"}`);
  }
}
