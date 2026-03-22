import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { validateBody } from "../_shared/validate.ts";

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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit check
    const userId = claimsData.claims.sub as string;
    const rateLimit = await checkRateLimit(userId, 'portfolio-chat', 30, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(corsHeaders, rateLimit.remaining, rateLimit.resetAt);
    }

    const ChatSchema = z.object({
      messages: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(10000),
      })).min(1).max(50),
    });

    const parsed = await validateBody(req, ChatSchema, corsHeaders);
    if ("error" in parsed) return parsed.error;
    const validatedMessages = parsed.data.messages;

    // Fetch portfolio data for context — minimised fields only (no PII, no exact balances)
    const [
      propertiesRes,
      entitiesRes,
      loansRes,
      complianceRes,
    ] = await Promise.all([
      supabase.from("properties_v2").select("id, address_line_1, postcode, property_type, total_lettable_rooms, current_valuation, epc_rating, lifecycle_stage"),
      supabase.from("legal_entities").select("id, entity_name, status"),
      supabase.from("loan_facilities").select("property_id, current_balance, interest_rate, rate_type, status").eq("status", "active"),
      supabase.from("compliance_documents_v2").select("property_id, document_type, status, expiry_date, is_current").eq("is_current", true),
    ]);

    const properties = propertiesRes.data || [];
    const entities = entitiesRes.data || [];
    const loans = loansRes.data || [];
    const complianceItems = complianceRes.data || [];

    // Build portfolio summary with minimised data
    const totalValue = properties.reduce((sum, p) => sum + (p.current_valuation || 0), 0);
    const totalDebt = loans.reduce((sum, l) => sum + (l.current_balance || 0), 0);
    const totalEquity = totalValue - totalDebt;

    // Round values to bands for privacy
    const roundToNearestK = (v: number) => Math.round(v / 1000) * 1000;

    const propertyDetails = properties.map(p => {
      const propertyLoans = loans.filter(l => l.property_id === p.id);
      const propertyCompliance = complianceItems.filter(c => c.property_id === p.id);
      const expiredCompliance = propertyCompliance.filter(c => c.status === 'expired');

      return {
        address: p.address_line_1,
        postcode: p.postcode,
        type: p.property_type,
        rooms: p.total_lettable_rooms,
        valueBand: `£${(roundToNearestK(p.current_valuation || 0) / 1000).toFixed(0)}k`,
        epc: p.epc_rating,
        lifecycle: p.lifecycle_stage,
        debtBand: propertyLoans.length > 0 ? `£${(roundToNearestK(propertyLoans.reduce((s, l) => s + (l.current_balance || 0), 0)) / 1000).toFixed(0)}k` : 'None',
        avgRate: propertyLoans.length > 0 ? (propertyLoans.reduce((s, l) => s + (l.interest_rate || 0), 0) / propertyLoans.length).toFixed(1) + '%' : 'N/A',
        expiredCertificates: expiredCompliance.map(c => c.document_type),
        complianceStatus: expiredCompliance.length > 0 ? 'Issues' : 'OK',
      };
    });

    const portfolioContext = `
PORTFOLIO DATA (as of ${new Date().toLocaleDateString('en-GB')}):

SUMMARY:
- Total Properties: ${properties.length}
- Total Portfolio Value: £${roundToNearestK(totalValue).toLocaleString()}
- Total Debt: £${roundToNearestK(totalDebt).toLocaleString()}
- Total Equity: £${roundToNearestK(totalEquity).toLocaleString()}
- LTV: ${totalValue > 0 ? ((totalDebt / totalValue) * 100).toFixed(1) : 0}%
- Entities: ${entities.length}

PROPERTIES:
${propertyDetails.map((p, i) => `
${i + 1}. ${p.address}, ${p.postcode}
   - Type: ${p.type || 'Not set'} | Rooms: ${p.rooms || 'N/A'}
   - Value: ${p.valueBand} | EPC: ${p.epc || 'N/A'}
   - Lifecycle: ${p.lifecycle || 'operational'}
   - Debt: ${p.debtBand} | Avg Rate: ${p.avgRate}
   - Compliance: ${p.complianceStatus}
   ${p.expiredCertificates.length > 0 ? `- ⚠️ EXPIRED: ${p.expiredCertificates.join(', ')}` : ''}
`).join('')}
`;

    const systemPrompt = `You are a helpful AI assistant for a UK property portfolio management system called Tenure IQ. You have access to the user's complete portfolio data and can answer questions about their properties, companies, finances, and compliance status.

${portfolioContext}

GUIDELINES:
- Answer questions about the portfolio data accurately and helpfully
- Use British English and UK property terminology
- Format currency as GBP (£)
- Format dates as DD/MM/YYYY
- Be concise but comprehensive
- If asked about data you don't have, say so clearly
- You can perform calculations based on the data (yields, LTV, etc.)
- Flag any compliance issues or upcoming deadlines proactively
- Keep responses conversational but professional`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...validatedMessages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream the response
    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-RateLimit-Remaining": String(rateLimit.remaining) },
    });
  } catch (error) {
    console.error("Portfolio chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
