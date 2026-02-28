import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

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
  };
}

interface PropertyLocation {
  address: string;
  postcode: string;
  postcodeArea: string;
  areaName: string;
  localAuthority: string;
  latitude?: number;
  longitude?: number;
  epcRating?: string;
  councilTaxBand?: string;
  propertyType?: string;
  beds?: number;
  currentValue?: number;
  annualRent?: number;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Verify user is authenticated
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit check
    const rateLimit = await checkRateLimit(userData.user.id, 'portfolio-location-insights', 10, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(corsHeaders, rateLimit.remaining, rateLimit.resetAt);
    }

    const { properties, portfolioSummary } = await req.json() as {
      properties: PropertyLocation[];
      portfolioSummary: string;
    };

    if (!properties || properties.length === 0) {
      return new Response(
        JSON.stringify({ error: "Property data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Group properties by postcode area and local authority
    const areaGroups: Record<string, { count: number; totalValue: number; avgRent: number; properties: string[] }> = {};
    const authorityGroups: Record<string, { count: number; properties: string[] }> = {};
    
    properties.forEach(p => {
      const area = p.postcodeArea || p.postcode?.split(' ')[0] || 'Unknown';
      if (!areaGroups[area]) {
        areaGroups[area] = { count: 0, totalValue: 0, avgRent: 0, properties: [] };
      }
      areaGroups[area].count++;
      areaGroups[area].totalValue += p.currentValue || 0;
      areaGroups[area].avgRent += p.annualRent || 0;
      areaGroups[area].properties.push(p.address);

      const authority = p.localAuthority || 'Unknown';
      if (!authorityGroups[authority]) {
        authorityGroups[authority] = { count: 0, properties: [] };
      }
      authorityGroups[authority].count++;
      authorityGroups[authority].properties.push(p.address);
    });

    // Calculate area stats
    Object.keys(areaGroups).forEach(area => {
      if (areaGroups[area].count > 0) {
        areaGroups[area].avgRent = areaGroups[area].avgRent / areaGroups[area].count;
      }
    });

    // Build location context for AI
    const locationContext = `
GEOGRAPHIC DISTRIBUTION:
${Object.entries(areaGroups)
  .sort((a, b) => b[1].count - a[1].count)
  .map(([area, data]) => `- ${area}: ${data.count} properties, £${(data.totalValue / 1000000).toFixed(2)}M total value, £${(data.avgRent / 12).toFixed(0)}/mo avg rent`)
  .join('\n')}

LOCAL AUTHORITY SPREAD:
${Object.entries(authorityGroups)
  .sort((a, b) => b[1].count - a[1].count)
  .map(([auth, data]) => `- ${auth}: ${data.count} properties`)
  .join('\n')}

PROPERTY DETAILS:
${properties.map(p => `- ${p.address}, ${p.postcode}: ${p.propertyType || 'Unknown type'}, ${p.beds || '?'} beds, EPC ${p.epcRating || '?'}, Council Tax ${p.councilTaxBand || '?'}, ${p.localAuthority || 'Unknown LA'}`).join('\n')}

PORTFOLIO SUMMARY:
${portfolioSummary}
`;

    const systemPrompt = `You are a UK property market analyst with deep knowledge of local markets, rental demand, property legislation, and area-specific factors.

Your task is to analyze a property portfolio's GEOGRAPHIC aspects and provide location-based insights that the owner wouldn't know from their internal data alone.

Consider:
1. Regional concentration risk (too many properties in one area)
2. Local authority-specific factors (HMO licensing strictness, selective licensing schemes, planning)
3. UK rental market trends by postcode area
4. Area regeneration projects, transport links, university/student demand
5. Council tax band efficiency relative to rental income
6. EPC legislation by local authority
7. Flood risk, conservation areas, listed building considerations
8. Section 24 tax implications for high-value concentrations

Your response MUST be valid JSON with this exact structure:
{
  "locationSummary": "2-3 sentences on geographic positioning",
  "concentrationRisk": {
    "level": "low" | "medium" | "high",
    "explanation": "Why this level"
  },
  "localAuthorityInsights": [
    { "authority": "Name", "insight": "Relevant local factor", "impact": "positive" | "neutral" | "negative" }
  ],
  "marketContext": [
    { "area": "Postcode area", "trend": "What's happening in this market", "recommendation": "Action to consider" }
  ],
  "externalRisks": [
    { "risk": "Description", "affectedProperties": ["addresses"], "mitigation": "What to do" }
  ],
  "opportunities": [
    { "opportunity": "Description", "rationale": "Why this makes sense for the portfolio" }
  ]
}

Be specific to UK property market. Reference actual locations mentioned. Don't be generic.`;

    const userPrompt = `Analyze this UK property portfolio's geographic factors and provide external market insights:

${locationContext}

Generate JSON response with location-based analysis. Focus on factors the landlord wouldn't know from their own records - market trends, local authority policies, area-specific risks and opportunities.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 3000,
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
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse JSON from response
    let insights;
    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith("```")) {
        jsonStr = jsonStr.slice(0, -3);
      }
      insights = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse location insights");
    }

    return new Response(
      JSON.stringify({ insights }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "X-RateLimit-Remaining": String(rateLimit.remaining) } }
    );
  } catch (error) {
    console.error("Location insights error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
