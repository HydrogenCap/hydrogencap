import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { createLogger, withInvocationLog } from "../_shared/logger.ts";
import { validateBody } from "../_shared/validate.ts";
import { requireActiveSubscription } from "../_shared/checkSubscription.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(withInvocationLog("generate-investor-report", async (req, log) => {
  const log = createLogger("generate-investor-report", req);
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Subscription check
    const subCheck = await requireActiveSubscription(userData.user.id, corsHeaders);
    if (!subCheck.allowed) return subCheck.response;

    // 3. Rate limit (10 per hour — report generation is expensive)
    const rateLimit = await checkRateLimit(userData.user.id, "generate-investor-report", 10, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(corsHeaders, rateLimit.remaining, rateLimit.resetAt);
    }

    // 4. Validate body
    const RequestSchema = z.object({
      report_type: z.enum(["quarterly", "annual", "custom"]),
      period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      investor_ids: z.array(z.string().uuid()).optional(),
      custom_sections: z.array(z.string()).optional(),
    });

    const parsed = await validateBody(req, RequestSchema, corsHeaders);
    if ("error" in parsed) return parsed.error;
    const { report_type, period_start, period_end, investor_ids, custom_sections } = parsed.data;

    log.info("Generating investor report", { report_type, period_start, period_end });

    // 5. Get user's org
    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", userData.user.id)
      .limit(1)
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "No organization found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = membership.org_id;

    // 6. Fetch comprehensive portfolio data
    const [
      propertiesRes,
      loansRes,
      complianceRes,
      investorsRes,
      distributionsRes,
      financialsRes,
    ] = await Promise.all([
      supabase
        .from("properties_v2")
        .select("id, name, address_line, city, postcode, current_value, purchase_price, monthly_rent, status, asset_category, bedrooms, bathrooms")
        .eq("org_id", orgId),
      supabase
        .from("loans")
        .select("id, property_id, lender_name, loan_amount, current_balance, interest_rate, loan_type, maturity_date, monthly_payment")
        .eq("org_id", orgId),
      supabase
        .from("compliance_items_v2")
        .select("id, property_id, compliance_type, status, expiry_date")
        .eq("org_id", orgId),
      supabase
        .from("investors")
        .select("id, name, email, investment_amount, ownership_percentage, investor_type")
        .eq("org_id", orgId),
      supabase
        .from("distributions")
        .select("id, investor_id, amount, distribution_date, distribution_type, status")
        .eq("org_id", orgId)
        .gte("distribution_date", period_start)
        .lte("distribution_date", period_end),
      supabase
        .from("financial_transactions")
        .select("id, property_id, amount, transaction_type, category, transaction_date, description")
        .eq("org_id", orgId)
        .gte("transaction_date", period_start)
        .lte("transaction_date", period_end),
    ]);

    const properties = propertiesRes.data || [];
    const loans = loansRes.data || [];
    const compliance = complianceRes.data || [];
    const investors = investorsRes.data || [];
    const distributions = distributionsRes.data || [];
    const financials = financialsRes.data || [];

    // 7. Calculate period metrics
    const totalPortfolioValue = properties.reduce((sum: number, p: any) => sum + (Number(p.current_value) || 0), 0);
    const totalPurchasePrice = properties.reduce((sum: number, p: any) => sum + (Number(p.purchase_price) || 0), 0);
    const totalMonthlyRent = properties.reduce((sum: number, p: any) => sum + (Number(p.monthly_rent) || 0), 0);
    const totalLoanBalance = loans.reduce((sum: number, l: any) => sum + (Number(l.current_balance) || 0), 0);
    const totalLoanAmount = loans.reduce((sum: number, l: any) => sum + (Number(l.loan_amount) || 0), 0);

    const capitalGrowth = totalPurchasePrice > 0
      ? ((totalPortfolioValue - totalPurchasePrice) / totalPurchasePrice * 100)
      : 0;

    const annualRentalIncome = totalMonthlyRent * 12;
    const grossYield = totalPortfolioValue > 0 ? (annualRentalIncome / totalPortfolioValue * 100) : 0;
    const ltv = totalPortfolioValue > 0 ? (totalLoanBalance / totalPortfolioValue * 100) : 0;

    const totalIncome = financials
      .filter((f: any) => f.transaction_type === "income")
      .reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0);
    const totalCosts = financials
      .filter((f: any) => f.transaction_type === "expense")
      .reduce((sum: number, f: any) => sum + Math.abs(Number(f.amount) || 0), 0);
    const netIncome = totalIncome - totalCosts;

    const incomeReturn = totalPortfolioValue > 0 ? (netIncome / totalPortfolioValue * 100) : 0;
    const totalReturn = incomeReturn + capitalGrowth;

    const occupiedProperties = properties.filter((p: any) => p.status === "occupied" || p.status === "let").length;
    const occupancyRate = properties.length > 0 ? (occupiedProperties / properties.length * 100) : 0;

    const complianceValid = compliance.filter((c: any) => c.status === "valid").length;
    const complianceRate = compliance.length > 0 ? (complianceValid / compliance.length * 100) : 0;

    const totalDistributed = distributions.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);

    const metrics = {
      totalPortfolioValue,
      totalPurchasePrice,
      capitalGrowth: capitalGrowth.toFixed(2),
      annualRentalIncome,
      grossYield: grossYield.toFixed(2),
      totalLoanBalance,
      ltv: ltv.toFixed(2),
      totalIncome,
      totalCosts,
      netIncome,
      incomeReturn: incomeReturn.toFixed(2),
      totalReturn: totalReturn.toFixed(2),
      occupancyRate: occupancyRate.toFixed(1),
      complianceRate: complianceRate.toFixed(1),
      propertyCount: properties.length,
      totalDistributed,
      investorCount: investors.length,
    };

    // 8. Determine period label
    const periodLabel = report_type === "quarterly"
      ? `Q${Math.ceil((new Date(period_end).getMonth() + 1) / 3)} ${new Date(period_end).getFullYear()}`
      : report_type === "annual"
        ? `FY ${new Date(period_end).getFullYear()}`
        : `${period_start} to ${period_end}`;

    // 9. Build AI prompt
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const defaultSections = [
      "Executive Summary",
      "Portfolio Overview",
      "Financial Performance",
      "Property Updates",
      "Compliance Status",
      "Market Commentary",
      "Outlook",
    ];
    const requestedSections = custom_sections && custom_sections.length > 0
      ? custom_sections
      : defaultSections;

    const systemPrompt = `You are a professional investment report writer for a UK property fund / portfolio.
Generate a formal investor report with these sections: ${requestedSections.join(", ")}.

Your response MUST be valid JSON with this exact structure:
{
  "title": "Report title (e.g. 'Quarterly Investor Report - Q1 2026')",
  "summary": "2-3 sentence executive summary",
  "sections": [
    {
      "heading": "Section heading",
      "content": "Section body text in markdown. Use **bold** for emphasis. Include specific numbers from the data provided. Write 2-4 paragraphs per section.",
      "data": null or { "key": "value" } for any structured data relevant to this section
    }
  ]
}

Guidelines:
- Use formal but accessible language suitable for institutional and private investors
- Include specific numbers, percentages, and GBP amounts from the data provided
- Compare metrics where relevant (e.g. occupancy vs target, yield vs benchmark)
- For Market Commentary, reference current UK property market conditions
- For Outlook, provide forward-looking statements with appropriate caveats
- Financial figures in GBP (£) with commas for thousands
- Percentages to 1 decimal place
- Be factual and data-driven, avoid vague statements`;

    const userPrompt = `Generate a ${report_type} investor report for the period ${period_start} to ${period_end} (${periodLabel}).

Portfolio Metrics:
${JSON.stringify(metrics, null, 2)}

Properties Summary (${properties.length} properties):
${JSON.stringify(properties.map((p: any) => ({
  name: p.name,
  address: p.address_line,
  city: p.city,
  value: p.current_value,
  rent: p.monthly_rent,
  status: p.status,
  type: p.asset_category,
})), null, 2)}

Lending Summary (${loans.length} loans):
- Total loan balance: £${totalLoanBalance.toLocaleString()}
- Weighted LTV: ${ltv.toFixed(1)}%
${loans.length > 0 ? `Loans: ${JSON.stringify(loans.map((l: any) => ({
  lender: l.lender_name,
  balance: l.current_balance,
  rate: l.interest_rate,
  maturity: l.maturity_date,
})), null, 2)}` : "No active loans."}

Income & Costs (period):
- Total Income: £${totalIncome.toLocaleString()}
- Total Costs: £${totalCosts.toLocaleString()}
- Net Income: £${netIncome.toLocaleString()}

Compliance:
- ${complianceValid} of ${compliance.length} items valid (${complianceRate.toFixed(1)}%)

Distributions (period):
- Total distributed: £${totalDistributed.toLocaleString()} across ${distributions.length} payments

Investors: ${investors.length} investors
${investor_ids && investor_ids.length > 0
  ? `Report targeted at specific investors: ${investor_ids.length} selected`
  : "Report for all investors"}

Required sections: ${requestedSections.join(", ")}`;

    log.info("Sending to AI gateway");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 6000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      log.error("AI gateway error", { status: response.status, body: errorText.slice(0, 200) });
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // 10. Parse AI response
    let aiResult;
    try {
      let jsonStr = content.trim();
      const jsonBlockStart = jsonStr.indexOf("```json");
      if (jsonBlockStart !== -1) {
        jsonStr = jsonStr.slice(jsonBlockStart + 7);
      } else if (jsonStr.indexOf("```") !== -1) {
        jsonStr = jsonStr.slice(jsonStr.indexOf("```") + 3);
      }
      if (jsonStr.indexOf("```") !== -1) {
        jsonStr = jsonStr.slice(0, jsonStr.indexOf("```"));
      }
      jsonStr = jsonStr.trim();
      if (!jsonStr.startsWith("{")) {
        const jsonStart = jsonStr.indexOf("{");
        if (jsonStart !== -1) {
          jsonStr = jsonStr.slice(jsonStart);
        }
      }
      aiResult = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      log.error("Failed to parse AI response", { content: content?.slice(0, 300) });
      throw new Error("Failed to parse AI report response");
    }

    // 11. Save as draft
    const reportTitle = aiResult.title || `${report_type.charAt(0).toUpperCase() + report_type.slice(1)} Investor Report - ${periodLabel}`;

    const { data: report, error: insertError } = await supabase
      .from("ai_investor_reports")
      .insert({
        org_id: orgId,
        title: reportTitle,
        report_type,
        period_start,
        period_end,
        sections: aiResult.sections || [],
        summary: aiResult.summary || null,
        generated_by: userData.user.id,
        status: "draft",
        recipients: investor_ids ? investor_ids.map((id: string) => ({ investor_id: id })) : [],
      })
      .select()
      .single();

    if (insertError) {
      log.error("Failed to save report", { error: insertError.message });
      throw new Error("Failed to save investor report");
    }

    log.info("Investor report generated", { reportId: report.id, sections: (aiResult.sections || []).length });

    return new Response(
      JSON.stringify({
        success: true,
        report,
        metrics,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      }
    );
  } catch (error) {
    log.error("Generate investor report error", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
