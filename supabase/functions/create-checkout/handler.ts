/**
 * Testable core of the create-checkout edge function.
 *
 * Creates a Stripe Checkout session for a subscription purchase. All external
 * dependencies (supabase client, Stripe client, allowed-origin predicate) are
 * injected via `deps`, so the handler has no top-level network imports.
 */

// deno-lint-ignore no-explicit-any
export type SupabaseLike = {
  auth: {
    getUser: (token: string) => Promise<{
      data: { user: { email?: string | null } | null };
      error: { message: string } | null;
    }>;
  };
};

export interface StripeCustomer {
  id: string;
}

export interface StripeCheckoutSession {
  url: string | null;
}

export interface StripeLike {
  customers: {
    list: (params: { email: string; limit: number }) => Promise<{ data: StripeCustomer[] }>;
  };
  checkout: {
    sessions: {
      create: (params: {
        customer?: string;
        customer_email?: string;
        line_items: Array<{ price: string; quantity: number }>;
        mode: string;
        success_url: string;
        cancel_url: string;
      }) => Promise<StripeCheckoutSession>;
    };
  };
}

export interface HandleDeps {
  supabase: SupabaseLike;
  stripe: StripeLike;
  corsHeaders: Record<string, string>;
  isAllowedOrigin: (origin: string) => boolean;
  allowedPriceIds: Set<string>;
  defaultBillingOrigin: string;
}

function json(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleCreateCheckout(req: Request, deps: HandleDeps): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: deps.corsHeaders });
  }

  try {
    // Auth: Bearer token → supabase.auth.getUser(token).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401, deps.corsHeaders);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await deps.supabase.auth.getUser(token);
    if (authError) {
      return json({ error: "Unauthorized" }, 401, deps.corsHeaders);
    }
    const user = data.user;
    if (!user?.email) {
      return json({ error: "User not authenticated or email not available" }, 401, deps.corsHeaders);
    }

    // Body validation. Only priceId is accepted; must be in the allow-list.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body", details: "Request body must be valid JSON" }, 400, deps.corsHeaders);
    }
    const { priceId } = (body as { priceId?: unknown }) ?? {};
    if (typeof priceId !== "string" || priceId.length === 0) {
      return json({ error: "Validation failed", details: [{ field: "priceId", message: "priceId is required" }] }, 400, deps.corsHeaders);
    }
    if (!priceId.startsWith("price_")) {
      return json({ error: "Validation failed", details: [{ field: "priceId", message: "priceId must start with price_" }] }, 400, deps.corsHeaders);
    }
    if (!deps.allowedPriceIds.has(priceId)) {
      return json({ error: "Unsupported priceId" }, 400, deps.corsHeaders);
    }

    // Reuse an existing Stripe customer if we already know this email.
    const customers = await deps.stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    // Pin success/cancel redirects to an allow-listed origin (or a safe default).
    const originHeader = req.headers.get("origin") || "";
    const origin = deps.isAllowedOrigin(originHeader) ? originHeader : deps.defaultBillingOrigin;

    const session = await deps.stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/settings?tab=billing&status=success`,
      cancel_url: `${origin}/settings?tab=billing&status=cancelled`,
    });

    return json({ url: session.url }, 200, deps.corsHeaders);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("create-checkout error:", error);
    return json({ error: message }, 500, deps.corsHeaders);
  }
}
