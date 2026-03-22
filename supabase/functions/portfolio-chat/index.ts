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

    // Fetch portfolio data for context
    const [
      propertiesRes,
      companiesRes,
      loansRes,
      complianceRes,
      incomeRes,
      costsRes,
    ] = await Promise.all([
      supabase.from("properties").select("*"),
      supabase.from("companies").select("*"),
      supabase.from("loans").select("*"),
      supabase.from("compliance_items").select("*, compliance_documents(*)"),
      supabase.from("income").select("*"),
      supabase.from("costs").select("*"),
    ]);

    const properties = propertiesRes.data || [];
    const companies = companiesRes.data || [];
    const loans = loansRes.data || [];
    const complianceItems = complianceRes.data || [];
    const incomeRecords = incomeRes.data || [];
    const costRecords = costsRes.data || [];

    // Build portfolio summary
    const totalValue = properties.reduce((sum, p) => sum + (p.current_value_gbp || 0), 0);
    const totalDebt = loans.reduce((sum, l) => sum + (l.current_mortgage_balance_gbp || 0), 0);
    const totalEquity = totalValue - totalDebt;
    const currentYear = new Date().getFullYear();
    const annualRent = incomeRecords
      .filter(i => i.year === currentYear)
      .reduce((sum, i) => sum + (i.annual_rent_gbp || 0), 0);

    const propertyDetails = properties.map(p => {
      const propertyLoans = loans.filter(l => l.property_id === p.id);
      const propertyIncome = incomeRecords.find(i => i.property_id === p.id && i.year === currentYear);
      const propertyCosts = costRecords.find(c => c.property_id === p.id && c.year === currentYear);
      const propertyCompliance = complianceItems.filter(c => c.property_id === p.id);
      
      const expiredCompliance = propertyCompliance.filter(c => {
        if (!c.expiry_date) return false;
        return new Date(c.expiry_date) < new Date();
      });

      return {
        address: p.address_line,
        postcode: p.postcode,
        type: p.property_type,
        beds: p.beds,
        value: p.current_value_gbp,
        epc: p.epc_rating,
        lifecycle: p.lifecycle_type,
        tenure: p.tenure,
        lender: propertyLoans[0]?.lender,
        mortgageBalance: propertyLoans[0]?.current_mortgage_balance_gbp,
        interestRate: propertyLoans[0]?.interest_rate_percent,
        annualRent: propertyIncome?.annual_rent_gbp,
        expiredCertificates: expiredCompliance.map(c => c.compliance_type),
      };
    });

    const companyDetails = companies.map(c => ({
      name: c.legal_name,
      companyNumber: c.company_number,
      status: c.status,
      accountsDueDate: c.accounts_due_date,
      confirmationStatementDue: c.confirmation_statement_due_date,
      incorporationDate: c.ch_incorporation_date,
    }));

    const portfolioContext = `
PORTFOLIO DATA (as of ${new Date().toLocaleDateString('en-GB')}):

SUMMARY:
- Total Properties: ${properties.length}
- Total Portfolio Value: £${totalValue.toLocaleString()}
- Total Debt: £${totalDebt.toLocaleString()}
- Total Equity: £${totalEquity.toLocaleString()}
- LTV: ${totalValue > 0 ? ((totalDebt / totalValue) * 100).toFixed(1) : 0}%
- Annual Rental Income: £${annualRent.toLocaleString()}
- Companies: ${companies.length}

PROPERTIES:
${propertyDetails.map((p, i) => `
${i + 1}. ${p.address}, ${p.postcode}
   - Type: ${p.type || 'Not set'} | Beds: ${p.beds || 'N/A'} | Tenure: ${p.tenure || 'N/A'}
   - Value: £${(p.value || 0).toLocaleString()} | EPC: ${p.epc || 'N/A'}
   - Lifecycle: ${p.lifecycle || 'operational'}
   - Lender: ${p.lender || 'None'} | Balance: £${(p.mortgageBalance || 0).toLocaleString()} | Rate: ${p.interestRate || 'N/A'}%
   - Annual Rent: £${(p.annualRent || 0).toLocaleString()}
   ${p.expiredCertificates.length > 0 ? `- ⚠️ EXPIRED: ${p.expiredCertificates.join(', ')}` : ''}
`).join('')}

COMPANIES:
${companyDetails.map((c, i) => `
${i + 1}. ${c.name} (${c.companyNumber || 'No number'})
   - Status: ${c.status}
   - Incorporated: ${c.incorporationDate || 'N/A'}
   - Accounts Due: ${c.accountsDueDate || 'N/A'}
   - Confirmation Statement Due: ${c.confirmationStatementDue || 'N/A'}
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
