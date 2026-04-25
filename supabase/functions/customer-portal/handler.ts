/**
 * Testable core of the customer-portal edge function.
 * Creates a Stripe billing-portal session for the authenticated user,
 * auto-creating a Stripe customer if none exists yet.
 */

// deno-lint-ignore no-explicit-any
export type SupabaseLike = {
  auth: {
    getUser: (token: string) => Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: { message: string } | null;
    }>;
  };
};

export interface StripeCustomer { id: string }
export interface StripeSession { url: string | null }

export interface StripeLike {
  customers: {
    list: (params: { email: string; limit: number }) => Promise<{ data: StripeCustomer[] }>;
    create: (params: { email: string; metadata?: Record<string, string> }) => Promise<StripeCustomer>;
  };
  billingPortal: {
    sessions: {
      create: (params: { customer: string; return_url: string }) => Promise<StripeSession>;
    };
  };
}

export interface HandleDeps {
  supabase: SupabaseLike;
  stripe: StripeLike;
  corsHeaders: Record<string, string>;
  isAllowedOrigin: (origin: string) => boolean;
  defaultBillingOrigin: string;
}

function json(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleCustomerPortal(req: Request, deps: HandleDeps): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: deps.corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401, deps.corsHeaders);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await deps.supabase.auth.getUser(token);
    if (userError) return json({ error: "Unauthorized" }, 401, deps.corsHeaders);

    const user = userData.user;
    if (!user?.email) {
      return json({ error: "User not authenticated or email not available" }, 401, deps.corsHeaders);
    }

    // Reuse existing customer or create one on the fly.
    const customers = await deps.stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string;
    if (customers.data.length === 0) {
      const newCustomer = await deps.stripe.customers.create({
        email: user.email,
        metadata: { supabase_uid: user.id },
      });
      customerId = newCustomer.id;
    } else {
      customerId = customers.data[0].id;
    }

    const originHeader = req.headers.get("origin") || "";
    const origin = deps.isAllowedOrigin(originHeader) ? originHeader : deps.defaultBillingOrigin;

    const portalSession = await deps.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/settings?tab=billing`,
    });

    return json({ url: portalSession.url }, 200, deps.corsHeaders);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("customer-portal error:", error);
    return json({ error: message }, 500, deps.corsHeaders);
  }
}
