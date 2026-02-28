import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://hydrogencap.com",
  "https://www.hydrogencap.com",
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized - Bearer token required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized - Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const endpoint = url.pathname.split("/").pop();

    // Route to different endpoints
    switch (endpoint) {
      case "summary":
        return await getPortfolioSummary(supabase);
      case "properties":
        return await getProperties(supabase, url.searchParams);
      case "companies":
        return await getCompanies(supabase);
      case "compliance":
        return await getComplianceStatus(supabase);
      case "loans":
        return await getLoans(supabase);
      case "actions":
        return await getActionItems(supabase);
      default:
        return await getPortfolioSummary(supabase);
    }
  } catch (error) {
    console.error("Portfolio API error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getPortfolioSummary(supabase: any) {
  const [propertiesRes, loansRes, incomeRes, companiesRes] = await Promise.all([
    supabase.from("properties").select("id, address_line, postcode, current_value_gbp, beds, property_type, lifecycle_type, epc_rating"),
    supabase.from("loans").select("current_mortgage_balance_gbp, interest_rate_percent, lender"),
    supabase.from("income").select("annual_rent_gbp, year, property_id"),
    supabase.from("companies").select("id, legal_name, status"),
  ]);

  const properties = propertiesRes.data || [];
  const loans = loansRes.data || [];
  const income = incomeRes.data || [];
  const companies = companiesRes.data || [];

  const currentYear = new Date().getFullYear();
  const totalValue = properties.reduce((sum: number, p: any) => sum + (p.current_value_gbp || 0), 0);
  const totalDebt = loans.reduce((sum: number, l: any) => sum + (l.current_mortgage_balance_gbp || 0), 0);
  const totalEquity = totalValue - totalDebt;
  const annualRent = income
    .filter((i: any) => i.year === currentYear)
    .reduce((sum: number, i: any) => sum + (i.annual_rent_gbp || 0), 0);
  const ltv = totalValue > 0 ? ((totalDebt / totalValue) * 100).toFixed(1) : "0";

  return new Response(JSON.stringify({
    summary: {
      totalProperties: properties.length,
      totalCompanies: companies.length,
      totalValueGBP: totalValue,
      totalDebtGBP: totalDebt,
      totalEquityGBP: totalEquity,
      ltvPercent: parseFloat(ltv),
      annualRentGBP: annualRent,
      grossYieldPercent: totalValue > 0 ? parseFloat(((annualRent / totalValue) * 100).toFixed(2)) : 0,
    },
    propertyBreakdown: {
      byLifecycle: groupBy(properties, "lifecycle_type"),
      byType: groupBy(properties, "property_type"),
      byEPC: groupBy(properties, "epc_rating"),
    },
    timestamp: new Date().toISOString(),
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getProperties(supabase: any, params: URLSearchParams) {
  const lifecycle = params.get("lifecycle");
  const limit = parseInt(params.get("limit") || "50");
  
  let query = supabase
    .from("properties")
    .select("id, address_line, postcode, current_value_gbp, beds, bathrooms, property_type, lifecycle_type, epc_rating, tenure, area_name, local_authority");
  
  if (lifecycle) {
    query = query.eq("lifecycle_type", lifecycle);
  }
  
  const { data, error } = await query.limit(limit);
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    properties: data,
    count: data.length,
    timestamp: new Date().toISOString(),
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getCompanies(supabase: any) {
  const { data, error } = await supabase
    .from("companies")
    .select("id, legal_name, company_number, status, company_type, accounts_due_date, confirmation_statement_due_date, ch_incorporation_date");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  const companiesWithAlerts = data.map((c: any) => ({
    ...c,
    accountsOverdue: c.accounts_due_date && new Date(c.accounts_due_date) < now,
    confirmationStatementOverdue: c.confirmation_statement_due_date && new Date(c.confirmation_statement_due_date) < now,
  }));

  return new Response(JSON.stringify({
    companies: companiesWithAlerts,
    count: data.length,
    timestamp: new Date().toISOString(),
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getComplianceStatus(supabase: any) {
  const { data, error } = await supabase
    .from("compliance_items")
    .select("id, compliance_type, expiry_date, is_required, is_manually_excluded, property_id");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  const items = data.filter((c: any) => c.is_required && !c.is_manually_excluded);
  
  const expired = items.filter((c: any) => c.expiry_date && new Date(c.expiry_date) < now);
  const expiringSoon = items.filter((c: any) => {
    if (!c.expiry_date) return false;
    const expiry = new Date(c.expiry_date);
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return expiry >= now && expiry <= thirtyDays;
  });
  const valid = items.filter((c: any) => {
    if (!c.expiry_date) return false;
    return new Date(c.expiry_date) > new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  });

  return new Response(JSON.stringify({
    compliance: {
      totalItems: items.length,
      expired: expired.length,
      expiringSoon30Days: expiringSoon.length,
      valid: valid.length,
      expiredItems: expired.map((c: any) => ({
        type: c.compliance_type,
        expiryDate: c.expiry_date,
        propertyId: c.property_id,
      })),
      expiringSoonItems: expiringSoon.map((c: any) => ({
        type: c.compliance_type,
        expiryDate: c.expiry_date,
        propertyId: c.property_id,
      })),
    },
    timestamp: new Date().toISOString(),
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getLoans(supabase: any) {
  const { data, error } = await supabase
    .from("loans")
    .select("id, property_id, lender, current_mortgage_balance_gbp, interest_rate_percent, fixed_rate_expires, capital_or_interest, fixed_or_variable");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  const loansWithAlerts = data.map((l: any) => ({
    ...l,
    fixedRateExpired: l.fixed_rate_expires && new Date(l.fixed_rate_expires) < now,
    fixedRateExpiringSoon: l.fixed_rate_expires && new Date(l.fixed_rate_expires) > now && 
      new Date(l.fixed_rate_expires) < new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
  }));

  const totalDebt = data.reduce((sum: number, l: any) => sum + (l.current_mortgage_balance_gbp || 0), 0);
  const avgRate = data.length > 0 
    ? data.reduce((sum: number, l: any) => sum + (l.interest_rate_percent || 0), 0) / data.length
    : 0;

  return new Response(JSON.stringify({
    loans: loansWithAlerts,
    summary: {
      totalLoans: data.length,
      totalDebtGBP: totalDebt,
      averageInterestRatePercent: parseFloat(avgRate.toFixed(2)),
      fixedRateExpiringSoon: loansWithAlerts.filter((l: any) => l.fixedRateExpiringSoon).length,
    },
    timestamp: new Date().toISOString(),
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getActionItems(supabase: any) {
  const [propertiesRes, complianceRes, loansRes, companiesRes] = await Promise.all([
    supabase.from("properties").select("id, address_line, postcode, current_value_gbp, epc_rating, lifecycle_type"),
    supabase.from("compliance_items").select("id, compliance_type, expiry_date, is_required, is_manually_excluded, property_id"),
    supabase.from("loans").select("id, property_id, current_mortgage_balance_gbp, fixed_rate_expires"),
    supabase.from("companies").select("id, legal_name, accounts_due_date, confirmation_statement_due_date"),
  ]);

  const actions: any[] = [];
  const now = new Date();
  const properties = propertiesRes.data || [];
  const compliance = complianceRes.data || [];
  const loans = loansRes.data || [];
  const companies = companiesRes.data || [];

  // Expired compliance
  compliance
    .filter((c: any) => c.is_required && !c.is_manually_excluded && c.expiry_date && new Date(c.expiry_date) < now)
    .forEach((c: any) => {
      const prop = properties.find((p: any) => p.id === c.property_id);
      actions.push({
        type: "EXPIRED_COMPLIANCE",
        priority: "high",
        description: `${c.compliance_type} expired on ${c.expiry_date}`,
        property: prop ? `${prop.address_line}, ${prop.postcode}` : "Unknown",
        propertyId: c.property_id,
      });
    });

  // Poor EPC ratings
  properties
    .filter((p: any) => p.lifecycle_type !== "development" && ["E", "F", "G"].includes(p.epc_rating))
    .forEach((p: any) => {
      actions.push({
        type: "POOR_EPC",
        priority: p.epc_rating === "G" ? "high" : "medium",
        description: `EPC rating ${p.epc_rating} requires improvement`,
        property: `${p.address_line}, ${p.postcode}`,
        propertyId: p.id,
      });
    });

  // Company filing deadlines
  companies.forEach((c: any) => {
    if (c.accounts_due_date && new Date(c.accounts_due_date) < now) {
      actions.push({
        type: "OVERDUE_ACCOUNTS",
        priority: "high",
        description: `Annual accounts overdue since ${c.accounts_due_date}`,
        company: c.legal_name,
        companyId: c.id,
      });
    }
    if (c.confirmation_statement_due_date && new Date(c.confirmation_statement_due_date) < now) {
      actions.push({
        type: "OVERDUE_CONFIRMATION_STATEMENT",
        priority: "high",
        description: `Confirmation statement overdue since ${c.confirmation_statement_due_date}`,
        company: c.legal_name,
        companyId: c.id,
      });
    }
  });

  // Fixed rate expiring soon
  loans
    .filter((l: any) => {
      if (!l.fixed_rate_expires) return false;
      const exp = new Date(l.fixed_rate_expires);
      return exp > now && exp < new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    })
    .forEach((l: any) => {
      const prop = properties.find((p: any) => p.id === l.property_id);
      actions.push({
        type: "FIXED_RATE_EXPIRING",
        priority: "medium",
        description: `Fixed rate expires on ${l.fixed_rate_expires}`,
        property: prop ? `${prop.address_line}, ${prop.postcode}` : "Unknown",
        propertyId: l.property_id,
      });
    });

  return new Response(JSON.stringify({
    actions: actions.sort((a, b) => (a.priority === "high" ? -1 : 1) - (b.priority === "high" ? -1 : 1)),
    summary: {
      total: actions.length,
      high: actions.filter(a => a.priority === "high").length,
      medium: actions.filter(a => a.priority === "medium").length,
    },
    timestamp: new Date().toISOString(),
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function groupBy(arr: any[], key: string) {
  return arr.reduce((acc, item) => {
    const val = item[key] || "Unknown";
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
