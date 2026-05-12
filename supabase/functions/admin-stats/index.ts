import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getAdminClient, type AdminSupabaseClient } from "../_shared/admin-client.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { withInvocationLog } from "../_shared/logger.ts";
type SubscriptionRow = {
  user_id: string;
  product_id: string | null;
  status: string;
  stripe_customer_id?: string | null;
  updated_at?: string;
};
type ProfileRow = {
  user_id: string;
  full_name: string | null;
  email: string;
  platform_role?: string;
};
type MembershipRow = {
  user_id: string;
  org_id: string;
  organizations?: { name?: string | null } | null;
};
type RecentUser = {
  id: string;
  email: string | null | undefined;
  created_at: string;
  last_sign_in_at: string | null | undefined;
};
type EnrichedUser = {
  id: string;
  email: string;
  full_name: string | null;
  org_name: string | null;
  org_id: string | null;
  tier: string;
  status: string;
  stripe_customer_id: string | null;
  created_at: string;
  last_sign_in_at: string | null | undefined;
};

serve(withInvocationLog("admin-stats", async (req, _invocationLog) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getAdminClient();

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
      case "activation_funnel":
        result = await getActivationFunnel(supabase);
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ADMIN-STATS] Error:", err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));

async function getDashboardStats(supabase: AdminSupabaseClient) {
  // Active subscriptions + MRR
  const { data: activeSubsData } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("status", "active");
  const activeSubs = (activeSubsData || []) as SubscriptionRow[];

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

  const { data: canceledSubsData } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("status", "canceled")
    .gte("updated_at", startOfMonth.toISOString());
  const canceledSubs = (canceledSubsData || []) as SubscriptionRow[];

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
  const recentUsers: RecentUser[] = ((authData?.users || []) as Array<{
    id: string;
    email?: string | null;
    created_at: string;
    last_sign_in_at?: string | null;
  }>)
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
    ((userSubs || []) as SubscriptionRow[]).map((s) => [s.user_id, s])
  );

  const enrichedRecent = recentUsers.map((u) => {
    const sub = subsByUser.get(u.id);
    const productId = typeof sub?.product_id === "string" ? sub.product_id : null;
    return {
      ...u,
      tier: productId ? PRODUCT_TO_TIER[productId] || "free" : "free",
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
  supabase: AdminSupabaseClient,
  params: { search?: string; tierFilter?: string; statusFilter?: string; page?: number; pageSize?: number }
) {
  const { search, tierFilter, statusFilter, page = 1, pageSize = 50 } = params;

  // Get all users
  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const users = (authData?.users || []) as Array<{
    id: string;
    email?: string | null;
    created_at: string;
    last_sign_in_at?: string | null;
  }>;

  // Get all profiles
  const { data: profilesData } = await supabase.from("profiles").select("user_id, full_name, email");
  const profiles = (profilesData || []) as ProfileRow[];
  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

  // Get all subscriptions
  const { data: subsData } = await supabase.from("subscriptions").select("*");
  const subs = (subsData || []) as SubscriptionRow[];
  const subMap = new Map(subs.map((s) => [s.user_id, s]));

  // Get memberships + orgs
  const { data: membershipsData } = await supabase
    .from("memberships")
    .select("user_id, org_id, organizations(name)");
  const memberships = (membershipsData || []) as MembershipRow[];
  const orgMap = new Map(
    memberships.map((m) => [m.user_id, m.organizations?.name || null])
  );

  // Get property counts per org
  const { data: orgIdsData } = await supabase
    .from("memberships")
    .select("user_id, org_id");
  const orgIds = (orgIdsData || []) as Array<{ user_id: string; org_id: string }>;
  const userOrgMap = new Map(orgIds.map((m) => [m.user_id, m.org_id]));

  const PRODUCT_TO_TIER: Record<string, string> = {
    prod_TxJdFT8No80v9S: "solo",
    prod_TxJeOM05Pg5FWE: "portfolio",
    prod_TxJeGRcMMMPHwP: "pro",
  };

  let enriched: EnrichedUser[] = users.map((u) => {
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
  supabase: AdminSupabaseClient,
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
  supabase: AdminSupabaseClient,
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
