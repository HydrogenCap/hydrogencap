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

// UK Compliance requirement definitions
const COMPLIANCE_DEFINITIONS = {
  'Gas Safety Certificate (CP12)': {
    category: 'Safety & Legal',
    validityYears: 1,
    defaultRequired: true,
  },
  'Electrical Safety Certificate (EICR)': {
    category: 'Safety & Legal',
    validityYears: 5,
    defaultRequired: true,
  },
  'EPC': {
    category: 'Safety & Legal',
    validityYears: 10,
    defaultRequired: true,
  },
  'Smoke Alarm Declaration': {
    category: 'Safety & Legal',
    validityYears: null,
    defaultRequired: true,
  },
  'Carbon Monoxide Alarm Declaration': {
    category: 'Safety & Legal',
    validityYears: null,
    defaultRequired: true,
  },
  'Fire Risk Assessment (FRA)': {
    category: 'Safety & Legal',
    validityYears: 1,
    defaultRequired: false,
  },
  'Legionella Risk Assessment': {
    category: 'Safety & Legal',
    validityYears: 2,
    defaultRequired: true,
  },
  'PAT Testing': {
    category: 'Safety & Legal',
    validityYears: 1,
    defaultRequired: false,
  },
  'HMO Licence': {
    category: 'HMO & Licensing',
    validityYears: 5,
    defaultRequired: false,
  },
  'Selective Licence': {
    category: 'HMO & Licensing',
    validityYears: 5,
    defaultRequired: false,
  },
  'Fire Alarm Certificate': {
    category: 'HMO & Licensing',
    validityYears: 1,
    defaultRequired: false,
  },
  'Emergency Lighting Certificate': {
    category: 'HMO & Licensing',
    validityYears: 1,
    defaultRequired: false,
  },
  'Fire Suppression System Certificate': {
    category: 'HMO & Licensing',
    validityYears: 1,
    defaultRequired: false,
  },
  'Buildings Insurance Schedule': {
    category: 'Insurance',
    validityYears: 1,
    defaultRequired: true,
  },
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
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
    const rateLimit = await checkRateLimit(userData.user.id, 'ai-compliance-checker', 20, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(corsHeaders, rateLimit.remaining, rateLimit.resetAt);
    }

    const { propertyId, propertyData, complianceItems, mode = 'analyze' } = await req.json();
    
    if (!propertyData) {
      return new Response(
        JSON.stringify({ error: "Property data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context about current compliance state
    const existingComplianceMap = new Map();
    (complianceItems || []).forEach((item: any) => {
      existingComplianceMap.set(item.compliance_type, item);
    });

    const currentDate = new Date().toISOString().split('T')[0];

    const systemPrompt = `You are a UK property compliance expert. Analyze property features and compliance status to provide intelligent recommendations.

Your response MUST be valid JSON with this exact structure:
{
  "analysis": {
    "summary": "2-3 sentence overview of this property's compliance status",
    "complianceScore": 0-100,
    "urgentActions": number of urgent actions needed
  },
  "requirements": [
    {
      "type": "Compliance type name",
      "required": true/false,
      "reason": "Why this is/isn't required based on property features",
      "status": "valid" | "expiring_soon" | "expired" | "missing" | "not_required",
      "priority": "high" | "medium" | "low",
      "recommendation": "Specific action recommendation"
    }
  ],
  "insights": [
    {
      "title": "Insight title",
      "description": "Detailed explanation",
      "type": "warning" | "info" | "suggestion",
      "actionable": true/false
    }
  ],
  "costEstimate": {
    "immediate": "£X-Y for urgent items",
    "annual": "£X-Y recurring compliance costs",
    "details": ["Cost breakdown items"]
  }
}

Compliance types to evaluate: ${Object.keys(COMPLIANCE_DEFINITIONS).join(', ')}

Property feature interpretation rules:
- has_gas: true = Gas Safety Certificate required annually
- asset_category containing 'HMO' = HMO compliance required
- is_hmo_licensed: true = HMO Licence required
- has_fire_alarm_system: true = Fire Alarm Certificate required
- has_emergency_lighting: true = Emergency Lighting Certificate required
- selective_licence_required: true = Selective Licence required
- epc_required: false typically means listed building exempt
- listed_status: affects some compliance requirements

Current date: ${currentDate}
Expiring soon = within 60 days
Consider UK regulations including:
- Smoke and Carbon Monoxide Alarm Regulations 2015
- Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020
- Gas Safety (Installation and Use) Regulations 1998
- Housing Act 2004 for HMO licensing`;

    const userPrompt = `Analyze this property for UK rental compliance requirements:

Property Details:
${JSON.stringify(propertyData, null, 2)}

Current Compliance Items:
${JSON.stringify(complianceItems || [], null, 2)}

Mode: ${mode}
${mode === 'analyze' ? 'Provide full analysis with all requirements and insights.' : ''}
${mode === 'quick' ? 'Provide only urgent actions and high-priority requirements.' : ''}
${mode === 'audit' ? 'Provide detailed audit-ready analysis with cost estimates and timeline.' : ''}

Determine which compliance items are required based on the property features, identify gaps, and provide actionable recommendations.`;

    console.log(`AI Compliance Check for property: ${propertyId || 'unknown'}, mode: ${mode}`);

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
        temperature: 0.2,
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
    let result;
    try {
      let jsonStr = content.trim();
      
      const jsonBlockStart = jsonStr.indexOf('```json');
      if (jsonBlockStart !== -1) {
        jsonStr = jsonStr.slice(jsonBlockStart + 7);
      } else if (jsonStr.indexOf('```') !== -1) {
        const blockStart = jsonStr.indexOf('```');
        jsonStr = jsonStr.slice(blockStart + 3);
      }
      
      if (jsonStr.indexOf('```') !== -1) {
        jsonStr = jsonStr.slice(0, jsonStr.indexOf('```'));
      }
      
      jsonStr = jsonStr.trim();
      if (!jsonStr.startsWith('{')) {
        const jsonStart = jsonStr.indexOf('{');
        if (jsonStart !== -1) {
          jsonStr = jsonStr.slice(jsonStart);
        }
      }
      
      result = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI compliance analysis");
    }

    console.log(`AI Compliance Check completed. Score: ${result.analysis?.complianceScore}, Urgent: ${result.analysis?.urgentActions}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        propertyId,
        ...result,
        generatedAt: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "X-RateLimit-Remaining": String(rateLimit.remaining) } }
    );
  } catch (error) {
    console.error("AI Compliance Checker error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
