import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger, withInvocationLog } from "../_shared/logger.ts";
import { validateBody } from "../_shared/validate.ts";
import { requireActiveSubscription } from "../_shared/checkSubscription.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import {
  LOAN_FACILITY_SELECT,
  loanFacilityToLegacyShape,
  warnIfPropertyIdSpaceMismatch,
} from "../_shared/loanFacility.ts";

const RequestSchema = z.object({
  address: z.string().min(1, "Address is required"),
  postcode: z.string().optional(),
  asking_price: z.number().positive().optional(),
  estimated_rental: z.number().positive().optional(),
  property_type: z.string().optional(),
  beds: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

serve(withInvocationLog("analyse-acquisition", async (req, _invocationLog) => {
  const log = createLogger("analyse-acquisition", req);
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    log.withUser(userId);

    // Subscription check
    const subCheck = await requireActiveSubscription(userId, corsHeaders);
    if (!subCheck.allowed) return subCheck.response;

    // Rate limit: 10 analyses per hour
    const rateLimit = await checkRateLimit(userId, "analyse-acquisition", 10, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(corsHeaders, rateLimit.remaining, rateLimit.resetAt);
    }

    // Validate input
    const parsed = await validateBody(req, RequestSchema, corsHeaders);
    if ("error" in parsed) return parsed.error;
    const input = parsed.data;

    log.info("Acquisition analysis requested", { address: input.address });

    // Resolve org_id
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("org_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!membership?.org_id) {
      return new Response(
        JSON.stringify({ error: "No organization found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = membership.org_id;

    // Fetch existing portfolio data
    const [propertiesRes, loansRes, incomeRes, complianceRes] = await Promise.all([
      // V2: properties_v2 (Prompt §7.C hot-fix). Remap address_line→address_line_1,
      // current_value_gbp→current_valuation, purchase_price_gbp→purchase_price.
      // V1 `beds` has no V2 scalar equivalent; surfaced as null with a warning.
      supabaseAdmin
        .from("properties_v2")
        .select("id, address_line_1, postcode, property_type, current_valuation, purchase_price")
        .eq("org_id", orgId),
      supabaseAdmin
        .from("loan_facilities")
        .select(LOAN_FACILITY_SELECT)
        .eq("org_id", orgId),
      supabaseAdmin
        .from("property_income_budgets")
        .select("property_id, tax_year, annual_rent_gbp")
        .in(
          "property_id",
          (await supabaseAdmin.from("properties_v2").select("id").eq("org_id", orgId)).data?.map((p: { id: string }) => p.id) || []
        ),
      supabaseAdmin
        .from("compliance_items")
        .select("property_id, compliance_type, status, expiry_date")
        .in(
          "property_id",
          (await supabaseAdmin.from("properties_v2").select("id").eq("org_id", orgId)).data?.map((p: { id: string }) => p.id) || []
        ),
    ]);

    const propertiesRaw = propertiesRes.data || [];
    console.warn(JSON.stringify({
      ts: new Date().toISOString(),
      fn: "analyse-acquisition",
      outcome: "v1_column_unavailable_in_v2",
      column: "beds",
      message: "properties_v2 has no scalar `beds` — bedroom counts omitted from acquisition analysis.",
    }));
    const properties = propertiesRaw.map((p: any) => ({
      id: p.id,
      address_line: p.address_line_1,
      postcode: p.postcode,
      property_type: p.property_type,
      beds: null,
      current_value_gbp: p.current_valuation,
      purchase_price_gbp: p.purchase_price,
    }));
    const facilityRows = (loansRes.data || []) as unknown as Array<{ id: string; property_id: string }>;
    warnIfPropertyIdSpaceMismatch(
      "analyse-acquisition",
      facilityRows,
      properties.map((p: { id: string }) => p.id),
    );
    const loans = ((loansRes.data || []) as unknown as Parameters<typeof loanFacilityToLegacyShape>[0][]).map(
      loanFacilityToLegacyShape,
    );
    const income = (incomeRes.data || []).map((r: any) => ({
      property_id: r.property_id,
      year: parseInt(String(r.tax_year ?? '').slice(0, 4), 10) || 0,
      annual_rent_gbp: r.annual_rent_gbp,
    }));
    const compliance = complianceRes.data || [];

    // Calculate portfolio metrics
    const totalProperties = properties.length;
    const totalValue = properties.reduce((sum: number, p: { current_value_gbp?: number | null }) => sum + (p.current_value_gbp || 0), 0);
    const totalDebt = loans.reduce((sum: number, l: { current_mortgage_balance_gbp?: number | null }) => sum + (l.current_mortgage_balance_gbp || 0), 0);

    // Geographic spread
    const postcodeAreas = properties
      .map((p: { postcode?: string | null }) => p.postcode?.split(" ")[0])
      .filter(Boolean);
    const postcodeDistribution: Record<string, number> = {};
    for (const area of postcodeAreas) {
      postcodeDistribution[area as string] = (postcodeDistribution[area as string] || 0) + 1;
    }

    // Property type mix
    const typeDistribution: Record<string, number> = {};
    for (const p of properties) {
      const t = (p as { property_type?: string | null }).property_type || "unknown";
      typeDistribution[t] = (typeDistribution[t] || 0) + 1;
    }

    // Lender concentration
    const lenderDistribution: Record<string, number> = {};
    for (const l of loans) {
      const lender = (l as { lender?: string | null }).lender || "unknown";
      lenderDistribution[lender] = (lenderDistribution[lender] || 0) + 1;
    }

    // Average yield
    const latestYear = Math.max(...income.map((i: { year: number }) => i.year), 0);
    const latestIncome = income.filter((i: { year: number }) => i.year === latestYear);
    const totalRent = latestIncome.reduce((sum: number, i: { annual_rent_gbp?: number | null }) => sum + (i.annual_rent_gbp || 0), 0);
    const avgYield = totalValue > 0 ? ((totalRent / totalValue) * 100).toFixed(2) : "N/A";

    const portfolioSummary = {
      totalProperties,
      totalValue,
      totalDebt,
      ltv: totalValue > 0 ? ((totalDebt / totalValue) * 100).toFixed(1) : "0",
      avgYield,
      postcodeDistribution,
      typeDistribution,
      lenderDistribution,
      complianceIssues: compliance.filter((c: { status?: string | null }) => c.status === "expired" || c.status === "missing").length,
    };

    // Build AI prompt
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a UK property investment analyst for TenureIQ. Analyse potential property acquisitions against an existing portfolio. You must return valid JSON only, no markdown.

Your response MUST be valid JSON with this exact structure:
{
  "overall_score": 0.0 to 1.0,
  "recommendation": "strong_buy" | "buy" | "hold" | "avoid",
  "strengths": ["string array of key positives"],
  "weaknesses": ["string array of key negatives"],
  "financial_analysis": {
    "gross_yield": number or null,
    "net_yield": number or null,
    "monthly_cashflow": number or null,
    "annual_roi": number or null,
    "price_per_bed": number or null,
    "sdlt_estimate": number or null,
    "total_acquisition_cost": number or null
  },
  "portfolio_fit_analysis": {
    "diversification_impact": "positive" | "neutral" | "negative",
    "geographic_concentration_risk": "low" | "medium" | "high",
    "type_concentration_risk": "low" | "medium" | "high",
    "lender_diversification_note": "string",
    "portfolio_yield_impact": "string describing impact"
  },
  "area_analysis": {
    "rental_demand": "strong" | "moderate" | "weak" | "unknown",
    "area_comparison": "string comparing with existing portfolio locations",
    "growth_outlook": "string"
  },
  "risk_factors": [{"factor": "string", "severity": "high" | "medium" | "low", "detail": "string"}],
  "ai_summary": "2-4 paragraph narrative summary with key recommendation rationale"
}`;

    const userPrompt = `Analyse this potential property acquisition:

**Target Property:**
- Address: ${input.address}
- Postcode: ${input.postcode || "Not provided"}
- Asking Price: ${input.asking_price ? `£${input.asking_price.toLocaleString()}` : "Not provided"}
- Estimated Monthly Rent: ${input.estimated_rental ? `£${input.estimated_rental.toLocaleString()}` : "Not provided"}
- Property Type: ${input.property_type || "Not specified"}
- Bedrooms: ${input.beds ?? "Not specified"}
- Notes: ${input.notes || "None"}

**Existing Portfolio Summary (${portfolioSummary.totalProperties} properties):**
- Total Portfolio Value: £${portfolioSummary.totalValue.toLocaleString()}
- Total Debt: £${portfolioSummary.totalDebt.toLocaleString()}
- Portfolio LTV: ${portfolioSummary.ltv}%
- Average Yield: ${portfolioSummary.avgYield}%
- Geographic Spread: ${JSON.stringify(portfolioSummary.postcodeDistribution)}
- Property Type Mix: ${JSON.stringify(portfolioSummary.typeDistribution)}
- Lender Distribution: ${JSON.stringify(portfolioSummary.lenderDistribution)}
- Compliance Issues: ${portfolioSummary.complianceIssues} outstanding

Consider: yield comparison vs portfolio average, portfolio diversification impact, geographic concentration, lender limits (typical max ~4 properties per lender), SDLT implications (additional property surcharge), financing options, area rental demand, and risk factors. Be specific about numbers where possible.`;

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
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI rate limit exceeded. Please try again later." }),
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

    // Parse JSON from response
    let result;
    try {
      let jsonStr = content.trim();

      const jsonBlockStart = jsonStr.indexOf("```json");
      if (jsonBlockStart !== -1) {
        jsonStr = jsonStr.slice(jsonBlockStart + 7);
      } else if (jsonStr.indexOf("```") !== -1) {
        const blockStart = jsonStr.indexOf("```");
        jsonStr = jsonStr.slice(blockStart + 3);
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

      result = JSON.parse(jsonStr.trim());
    } catch (_parseError) {
      log.error("Failed to parse AI response", { content: content?.slice(0, 300) });
      throw new Error("Failed to parse AI acquisition analysis");
    }

    // Save to database
    const { data: analysis, error: insertError } = await supabaseAdmin
      .from("acquisition_analyses")
      .insert({
        org_id: orgId,
        address: input.address,
        postcode: input.postcode || null,
        asking_price: input.asking_price || null,
        estimated_rental: input.estimated_rental || null,
        property_type: input.property_type || null,
        beds: input.beds ?? null,
        notes: input.notes || null,
        overall_score: result.overall_score ?? null,
        recommendation: result.recommendation ?? null,
        strengths: result.strengths ?? [],
        weaknesses: result.weaknesses ?? [],
        financial_analysis: result.financial_analysis ?? {},
        portfolio_fit_analysis: result.portfolio_fit_analysis ?? {},
        area_analysis: result.area_analysis ?? {},
        risk_factors: result.risk_factors ?? [],
        ai_summary: result.ai_summary ?? null,
        model_used: "google/gemini-2.5-flash",
      })
      .select()
      .single();

    if (insertError) {
      log.error("Failed to save analysis", { error: insertError.message });
      // Return the result even if save fails
    }

    log.info("Acquisition analysis completed", {
      recommendation: result.recommendation,
      score: result.overall_score,
      analysisId: analysis?.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        analysis: analysis || { ...result, address: input.address },
        ...result,
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
    log.error("Acquisition analysis error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
