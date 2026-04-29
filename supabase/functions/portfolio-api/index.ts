import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { withInvocationLog } from "../_shared/logger.ts";
const ALLOWED_ORIGINS = [
  "https://tenureiq.com",
  "https://www.tenureiq.com",
  "https://hydrogencapital.lovable.app",
  Deno.env.get("ALLOWED_ORIGIN"),
].filter(Boolean) as string[];

let corsHeaders: Record<string, string> = {};

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

serve(withInvocationLog("portfolio-api", async (req, log) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized - Bearer token required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized - Invalid token" }, 401);
    }

    const url = new URL(req.url);
    const endpoint = url.pathname.split("/").pop();

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
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Internal server error" },
      500
    );
  }
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface PortfolioPropertyRow {
  id: string;
  address_line_1: string | null;
  postcode: string | null;
  current_valuation: number | null;
  property_type?: string | null;
  epc_rating?: string | null;
}

interface PortfolioLoanRow {
  id?: string;
  property_id: string | null;
  current_balance: number | null;
  interest_rate?: number | null;
  rate_expiry_date?: string | null;
}

interface PortfolioEntityRow {
  id: string;
  entity_name: string | null;
}

interface PortfolioComplianceRow {
  id: string;
  document_type: string | null;
  expiry_date: string | null;
  status: string | null;
  property_id: string | null;
}

interface ActionItem {
  type: string;
  priority: "high" | "medium";
  description: string;
  property?: string;
  propertyId?: string;
  entity?: string;
  entityId?: string;
}

// ─── V2 Handlers ──────────────────────────────────────────────────────

async function getPortfolioSummary(supabase: any) {
  const [propertiesRes, loansRes, entitiesRes] = await Promise.all([
    supabase.from("properties_v2").select("id, address_line_1, postcode, current_valuation, total_lettable_rooms, property_type, epc_rating"),
    supabase.from("loan_facilities").select("current_balance, interest_rate, property_id").eq("status", "active"),
    supabase.from("legal_entities").select("id, entity_name, status"),
  ]);

  const properties = (propertiesRes.data || []) as PortfolioPropertyRow[];
  const loans = (loansRes.data || []) as PortfolioLoanRow[];
  const entities = (entitiesRes.data || []) as PortfolioEntityRow[];

  const totalValue = properties.reduce((sum, p) => sum + (p.current_valuation || 0), 0);
  const totalDebt = loans.reduce((sum, l) => sum + (l.current_balance || 0), 0);
  const totalEquity = totalValue - totalDebt;
  const ltv = totalValue > 0 ? ((totalDebt / totalValue) * 100).toFixed(1) : "0";

  return jsonResponse({
    summary: {
      totalProperties: properties.length,
      totalEntities: entities.length,
      totalValueGBP: totalValue,
      totalDebtGBP: totalDebt,
      totalEquityGBP: totalEquity,
      ltvPercent: parseFloat(ltv),
    },
    propertyBreakdown: {
      byType: groupBy(properties, "property_type"),
      byEPC: groupBy(properties, "epc_rating"),
    },
    timestamp: new Date().toISOString(),
  });
}

async function getProperties(supabase: any, params: URLSearchParams) {
  const limit = Math.min(parseInt(params.get("limit") || "50"), 200);

  let query = supabase
    .from("properties_v2")
    .select("id, address_line_1, address_line_2, city, postcode, current_valuation, total_lettable_rooms, property_type, epc_rating, entity_id");

  const { data, error } = await query.limit(limit);

  if (error) return jsonResponse({ error: error.message }, 500);

  return jsonResponse({
    properties: data,
    count: (data || []).length,
    timestamp: new Date().toISOString(),
  });
}

async function getCompanies(supabase: any) {
  const { data, error } = await supabase
    .from("legal_entities")
    .select("id, entity_name, entity_type, company_number, status, incorporation_date");

  if (error) return jsonResponse({ error: error.message }, 500);

  return jsonResponse({
    entities: data,
    count: (data || []).length,
    timestamp: new Date().toISOString(),
  });
}

async function getComplianceStatus(supabase: any) {
  const { data, error } = await supabase
    .from("compliance_documents_v2")
    .select("id, document_type, expiry_date, status, property_id, is_current")
    .eq("is_current", true);

  if (error) return jsonResponse({ error: error.message }, 500);

  const items = (data || []) as PortfolioComplianceRow[];

  const expired = items.filter(c => c.status === 'expired');
  const expiringSoon = items.filter(c => c.status === 'critical' || c.status === 'expiring_soon');
  const valid = items.filter(c => c.status === 'valid');

  return jsonResponse({
    compliance: {
      totalDocuments: items.length,
      expired: expired.length,
      expiringSoon: expiringSoon.length,
      valid: valid.length,
      expiredItems: expired.map(c => ({
        type: c.document_type,
        expiryDate: c.expiry_date,
        propertyId: c.property_id,
      })),
      expiringSoonItems: expiringSoon.map(c => ({
        type: c.document_type,
        expiryDate: c.expiry_date,
        propertyId: c.property_id,
      })),
    },
    timestamp: new Date().toISOString(),
  });
}

async function getLoans(supabase: any) {
  const { data, error } = await supabase
    .from("loan_facilities")
    .select("id, property_id, lender_id, current_balance, interest_rate, rate_type, repayment_type, rate_expiry_date, monthly_payment, status, facility_type")
    .eq("status", "active");

  if (error) return jsonResponse({ error: error.message }, 500);

  const loans = (data || []) as PortfolioLoanRow[];
  const now = new Date();

  const loansWithAlerts = loans.map(l => ({
    ...l,
    fixedRateExpired: l.rate_expiry_date && new Date(l.rate_expiry_date) < now,
    fixedRateExpiringSoon: l.rate_expiry_date && new Date(l.rate_expiry_date) > now &&
      new Date(l.rate_expiry_date) < new Date(now.getTime() + 90 * 86400000),
  }));

  const totalDebt = loans.reduce((sum, l) => sum + (l.current_balance || 0), 0);
  const avgRate = loans.length > 0
    ? loans.reduce((sum, l) => sum + (l.interest_rate || 0), 0) / loans.length
    : 0;

  return jsonResponse({
    loans: loansWithAlerts,
    summary: {
      totalLoans: loans.length,
      totalDebtGBP: totalDebt,
      averageInterestRatePercent: parseFloat(avgRate.toFixed(2)),
      fixedRateExpiringSoon: loansWithAlerts.filter(l => l.fixedRateExpiringSoon).length,
    },
    timestamp: new Date().toISOString(),
  });
}

async function getActionItems(supabase: any) {
  const [propertiesRes, complianceRes, loansRes] = await Promise.all([
    supabase.from("properties_v2").select("id, address_line_1, postcode, current_valuation, epc_rating"),
    supabase.from("compliance_documents_v2").select("id, document_type, expiry_date, status, property_id, is_current").eq("is_current", true),
    supabase.from("loan_facilities").select("id, property_id, current_balance, rate_expiry_date").eq("status", "active"),
  ]);

  const actions: ActionItem[] = [];
  const properties = (propertiesRes.data || []) as PortfolioPropertyRow[];
  const compliance = (complianceRes.data || []) as PortfolioComplianceRow[];
  const loans = (loansRes.data || []) as PortfolioLoanRow[];
  const now = new Date();

  // Expired compliance documents
  compliance
    .filter(c => c.status === 'expired')
    .forEach(c => {
      const prop = properties.find(p => p.id === c.property_id);
      actions.push({
        type: "EXPIRED_COMPLIANCE",
        priority: "high",
        description: `${c.document_type} expired on ${c.expiry_date}`,
        property: prop ? `${prop.address_line_1}, ${prop.postcode}` : "Unknown",
        propertyId: c.property_id ?? undefined,
      });
    });

  // Poor EPC ratings
  properties
    .filter(p => ["E", "F", "G"].includes(p.epc_rating || ""))
    .forEach(p => {
      actions.push({
        type: "POOR_EPC",
        priority: p.epc_rating === "G" ? "high" : "medium",
        description: `EPC rating ${p.epc_rating} requires improvement`,
        property: `${p.address_line_1}, ${p.postcode}`,
        propertyId: p.id,
      });
    });

  // Fixed rate expiring soon
  loans
    .filter(l => {
      if (!l.rate_expiry_date) return false;
      const exp = new Date(l.rate_expiry_date);
      return exp > now && exp < new Date(now.getTime() + 90 * 86400000);
    })
    .forEach(l => {
      const prop = properties.find(p => p.id === l.property_id);
      actions.push({
        type: "FIXED_RATE_EXPIRING",
        priority: "medium",
        description: `Fixed rate expires on ${l.rate_expiry_date}`,
        property: prop ? `${prop.address_line_1}, ${prop.postcode}` : "Unknown",
        propertyId: l.property_id ?? undefined,
      });
    });

  return jsonResponse({
    actions: actions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    summary: {
      total: actions.length,
      high: actions.filter(a => a.priority === "high").length,
      medium: actions.filter(a => a.priority === "medium").length,
    },
    timestamp: new Date().toISOString(),
  });
}

function groupBy<T extends object>(arr: T[], key: keyof T): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, item) => {
    const val = String(item[key] || "Unknown");
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}
