import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireActiveSubscription } from "../_shared/checkSubscription.ts";

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

    // Subscription check
    const subCheck = await requireActiveSubscription(userData.user.id, corsHeaders);
    if (!subCheck.allowed) return subCheck.response;

    // Rate limit check
    const rateLimit = await checkRateLimit(userData.user.id, 'portfolio-insights', 10, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(corsHeaders, rateLimit.remaining, rateLimit.resetAt);
    }

    const { portfolioData } = await req.json();
    
    if (!portfolioData) {
      return new Response(
        JSON.stringify({ error: "Portfolio data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a UK property portfolio analyst. Generate insights based ONLY on the provided data.
Do NOT make assumptions or reference external market data. Every statement must be backed by the data provided.

Your response MUST be valid JSON with this exact structure:
{
  "overview": "2-4 sentences summarizing portfolio health and key metrics",
  "priorities": [
    { "text": "Priority item", "reason": "Brief explanation" }
  ],
  "risks": [
    { "text": "Risk description", "reason": "Why this matters", "filterType": "filter_key" }
  ],
  "opportunities": [
    { "text": "Opportunity description", "reason": "Potential benefit", "filterType": "filter_key" }
  ]
}

Filter types available: ltv_above_75, ltv_above_85, negative_cashflow, rate_expiry_3m, rate_expiry_12m, epc_below_c, missing_passport

Keep insights actionable and specific. Reference actual numbers from the data.`;

    const userPrompt = `Analyze this UK property portfolio and provide insights:

${portfolioData}

Generate JSON response with overview, top 5 priorities, risks, and opportunities based ONLY on this data.`;

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
        max_tokens: 2000,
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

    // Parse JSON from response (handle markdown code blocks and leading text)
    let insights;
    try {
      let jsonStr = content.trim();
      
      // Find JSON block - it might have text before the markdown
      const jsonBlockStart = jsonStr.indexOf('```json');
      if (jsonBlockStart !== -1) {
        jsonStr = jsonStr.slice(jsonBlockStart + 7);
      } else if (jsonStr.indexOf('```') !== -1) {
        const blockStart = jsonStr.indexOf('```');
        jsonStr = jsonStr.slice(blockStart + 3);
      }
      
      // Remove trailing markdown
      if (jsonStr.indexOf('```') !== -1) {
        jsonStr = jsonStr.slice(0, jsonStr.indexOf('```'));
      }
      
      // Try to find raw JSON if no markdown blocks
      jsonStr = jsonStr.trim();
      if (!jsonStr.startsWith('{')) {
        const jsonStart = jsonStr.indexOf('{');
        if (jsonStart !== -1) {
          jsonStr = jsonStr.slice(jsonStart);
        }
      }
      
      insights = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI insights");
    }

    return new Response(
      JSON.stringify({ insights }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "X-RateLimit-Remaining": String(rateLimit.remaining) } }
    );
  } catch (error) {
    console.error("Portfolio insights error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
