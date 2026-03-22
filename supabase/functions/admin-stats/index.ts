import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://tenureiq.com",
  "https://www.tenureiq.com",
  "https://hydrogencapital.lovable.app",
  Deno.env.get("ALLOWED_ORIGIN"),
].filter(Boolean) as string[];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("platform_role")
      .eq("user_id", userData.user.id)
      .single();

    if (!profile || profile.platform_role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    let result: unknown;

    switch (action) {
      case "dashboard":
        result = await getDashboardStats(supabase);
        break;
      case "users":
        result = await getUsers(supabase, params);
        break;
      case "grant_trial":
        result = await grantTrial(supabase, params);
        break;
      case "change_plan":
        result = await changePlan(supabase, params);
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ADMIN-STATS] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getDashboardStats(supabase: ReturnType<typeof createClient>) {
  // Active subscriptions + MRR
  const { data: activeSubs } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("status", "active");

  const activeCount = activeSubs?.length || 0;

  // Product ID to monthly amount mapping (pence)
  const TIER_PRICES: Record<string, number> = {
    prod_TxJdFT8No80v9S: 2900, // Solo £29
    prod_TxJeOM05Pg5FWE: 7900, // Portfolio £79
    prod_TxJeGRcMMMPHwP: 14900, // Pro £149
  };

  const mrr = (activeSubs || []).reduce((sum, sub) => {
    return sum + (TIER_PRICES[sub.product_id || ""] || 0);
  }, 0);

  // Total users
  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const totalUsers = authData?.users?.length || 0;

  // Churn this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: canceledSubs } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("status", "canceled")
    .gte("updated_at", startOfMonth.toISOString());

  const churnCount = canceledSubs?.length || 0;

  // Tier breakdown
  const PRODUCT_TO_TIER: Record<string, string> = {
    prod_TxJdFT8No80v9S: "solo",
    prod_TxJeOM05Pg5FWE: "portfolio",
    prod_TxJeGRcMMMPHwP: "pro",
  };

  const tierBreakdown: Record<string, { count: number; mrr: number }> = {
    free: { count: 0, mrr: 0 },
    solo: { count: 0, mrr: 0 },
    portfolio: { count: 0, mrr: 0 },
    pro: { count: 0, mrr: 0 },
  };

  for (const sub of activeSubs || []) {
    const tier = PRODUCT_TO_TIER[sub.product_id || ""] || "free";
    tierBreakdown[tier].count++;
    tierBreakdown[tier].mrr += TIER_PRICES[sub.product_id || ""] || 0;
  }

  // Free users = total - subscribers
  tierBreakdown.free.count = Math.max(0, totalUsers - activeCount);

  // Recent signups (last 20)
  const recentUsers = (authData?.users || [])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)
    .map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }));

  // Enrich recent signups with subscription info
  const userIds = recentUsers.map((u) => u.id);
  const { data: userSubs } = await supabase
    .from("subscriptions")
    .select("user_id, status, product_id")
    .in("user_id", userIds);

  const subsByUser = new Map(
    (userSubs || []).map((s) => [s.user_id, s])
  );

  const enrichedRecent = recentUsers.map((u) => {
    const sub = subsByUser.get(u.id);
    return {
      ...u,
      tier: sub ? PRODUCT_TO_TIER[sub.product_id || ""] || "free" : "free",
      status: sub?.status || "free",
    };
  });

  return {
    mrr,
    activeCount,
    totalUsers,
    churnCount,
    tierBreakdown,
    recentSignups: enrichedRecent,
  };
}

async function getUsers(
  supabase: ReturnType<typeof createClient>,
  params: { search?: string; tierFilter?: string; statusFilter?: string; page?: number; pageSize?: number }
) {
  const { search, tierFilter, statusFilter, page = 1, pageSize = 50 } = params;

  // Get all users
  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  let users = authData?.users || [];

  // Get all profiles
  const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email");
  const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

  // Get all subscriptions
  const { data: subs } = await supabase.from("subscriptions").select("*");
  const subMap = new Map((subs || []).map((s) => [s.user_id, s]));

  // Get memberships + orgs
  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id, org_id, organizations(name)");
  const orgMap = new Map(
    (memberships || []).map((m) => [m.user_id, (m.organizations as any)?.name || null])
  );

  // Get property counts per org
  const { data: orgIds } = await supabase
    .from("memberships")
    .select("user_id, org_id");
  const userOrgMap = new Map((orgIds || []).map((m) => [m.user_id, m.org_id]));

  const PRODUCT_TO_TIER: Record<string, string> = {
    prod_TxJdFT8No80v9S: "solo",
    prod_TxJeOM05Pg5FWE: "portfolio",
    prod_TxJeGRcMMMPHwP: "pro",
  };

  let enriched = users.map((u) => {
    const profile = profileMap.get(u.id);
    const sub = subMap.get(u.id);
    const tier = sub ? PRODUCT_TO_TIER[sub.product_id || ""] || "free" : "free";
    const status = sub?.status || "free";

    return {
      id: u.id,
      email: u.email || "",
      full_name: profile?.full_name || null,
      org_name: orgMap.get(u.id) || null,
      org_id: userOrgMap.get(u.id) || null,
      tier,
      status,
      stripe_customer_id: sub?.stripe_customer_id || null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    };
  });

  // Apply filters
  if (search) {
    const s = search.toLowerCase();
    enriched = enriched.filter(
      (u) =>
        u.email.toLowerCase().includes(s) ||
        (u.full_name && u.full_name.toLowerCase().includes(s)) ||
        (u.org_name && u.org_name.toLowerCase().includes(s))
    );
  }

  if (tierFilter && tierFilter !== "all") {
    enriched = enriched.filter((u) => u.tier === tierFilter);
  }

  if (statusFilter && statusFilter !== "all") {
    enriched = enriched.filter((u) => u.status === statusFilter);
  }

  // Sort by created_at desc
  enriched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total = enriched.length;
  const start = (page - 1) * pageSize;
  const paged = enriched.slice(start, start + pageSize);

  return { users: paged, total, page, pageSize };
}

async function grantTrial(
  supabase: ReturnType<typeof createClient>,
  params: { userId: string; days?: number }
) {
  const { userId, days = 14 } = params;
  const trialEnd = new Date(Date.now() + days * 86400000).toISOString();

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      status: "trialing",
      product_id: "prod_TxJdFT8No80v9S", // Solo tier for trial
      current_period_end: trialEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
  return { success: true, trial_end: trialEnd };
}

async function changePlan(
  supabase: ReturnType<typeof createClient>,
  params: { userId: string; newTier: string }
) {
  const { userId, newTier } = params;
  const TIER_TO_PRODUCT: Record<string, string> = {
    solo: "prod_TxJdFT8No80v9S",
    portfolio: "prod_TxJeOM05Pg5FWE",
    pro: "prod_TxJeGRcMMMPHwP",
  };

  const productId = TIER_TO_PRODUCT[newTier];
  if (!productId) throw new Error(`Invalid tier: ${newTier}`);

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      status: "active",
      product_id: productId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
  return { success: true, tier: newTier };
}
