import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { createLogger, withInvocationLog } from "../_shared/logger.ts";
import { requireActiveSubscription } from "../_shared/checkSubscription.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RequestAuthorization {
  mode: "cron" | "user";
  userId: string | null;
  orgIds: string[];
}

async function authorizeRequest(req: Request): Promise<RequestAuthorization> {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");

  // Cron mode: service-level access for all orgs
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id");
    return {
      mode: "cron",
      userId: null,
      orgIds: (orgs || []).map((o: { id: string }) => o.id),
    };
  }

  // User mode: auth token
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id);

  if (membershipError) throw membershipError;

  const orgIds = [...new Set((memberships || []).map((m: { org_id: string }) => m.org_id))];
  if (orgIds.length === 0) {
    throw new Error("No organization membership");
  }

  return { mode: "user", userId: user.id, orgIds };
}

interface AIAlert {
  title: string;
  category: string;
  severity: string;
  summary: string;
  details: string;
  source_url: string;
  effective_date: string | null;
  affects_property_types: string[];
  recommended_actions: string[];
}

const VALID_CATEGORIES = [
  "housing_act", "hmo_regs", "fire_safety", "epc_regs",
  "tenancy_law", "tax_changes", "licensing", "planning", "other",
];

const VALID_SEVERITIES = ["info", "warning", "critical"];

function sanitizeAlert(raw: Record<string, unknown>): AIAlert | null {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return null;

  let category = typeof raw.category === "string" ? raw.category.toLowerCase().trim() : "other";
  if (!VALID_CATEGORIES.includes(category)) category = "other";

  let severity = typeof raw.severity === "string" ? raw.severity.toLowerCase().trim() : "info";
  if (!VALID_SEVERITIES.includes(severity)) severity = "info";

  return {
    title,
    category,
    severity,
    summary: typeof raw.summary === "string" ? raw.summary : "",
    details: typeof raw.details === "string" ? raw.details : "",
    source_url: typeof raw.source_url === "string" ? raw.source_url : "",
    effective_date: typeof raw.effective_date === "string" ? raw.effective_date : null,
    affects_property_types: Array.isArray(raw.affects_property_types)
      ? raw.affects_property_types.filter((t: unknown) => typeof t === "string")
      : [],
    recommended_actions: Array.isArray(raw.recommended_actions)
      ? raw.recommended_actions.filter((a: unknown) => typeof a === "string")
      : [],
  };
}

serve(withInvocationLog("check-regulatory-changes", async (req, _invocationLog) => {
  const log = createLogger("check-regulatory-changes", req);
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorization = await authorizeRequest(req);
    log.info("Authorized", { mode: authorization.mode, orgCount: authorization.orgIds.length });

    // Rate limit for manual triggers only
    if (authorization.mode === "user" && authorization.userId) {
      const subCheck = await requireActiveSubscription(authorization.userId, corsHeaders);
      if (!subCheck.allowed) return subCheck.response;

      const rateLimit = await checkRateLimit(authorization.userId, "check-regulatory-changes", 5, 60);
      if (!rateLimit.allowed) {
        return rateLimitResponse(corsHeaders, rateLimit.remaining, rateLimit.resetAt);
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const currentDate = new Date().toISOString().split("T")[0];

    let totalInserted = 0;

    for (const orgId of authorization.orgIds) {
      // Fetch org's property profile for context
      const { data: properties } = await supabase
        .from("properties")
        .select("asset_category, council_name, postcode")
        .eq("org_id", orgId)
        .limit(50);

      const propertyTypes = [
        ...new Set((properties || []).map((p: { asset_category: string | null }) => p.asset_category).filter(Boolean)),
      ];
      const councils = [
        ...new Set((properties || []).map((p: { council_name: string | null }) => p.council_name).filter(Boolean)),
      ];

      const systemPrompt = `You are a UK property compliance expert. Based on the current date and recent UK legislation, identify any regulatory changes, upcoming deadlines, or new requirements that affect HMO landlords and BTL investors. Consider: Renters' Reform Bill, Building Safety Act, EPC minimum rating changes, fire safety regulations, selective licensing schemes, Awaab's Law, Section 21 abolition timeline, SDLT changes. For each alert, provide: title, category, severity, summary, effective date, affected property types, and recommended actions.

Your response MUST be valid JSON with this exact structure:
{
  "alerts": [
    {
      "title": "Short descriptive title",
      "category": "housing_act|hmo_regs|fire_safety|epc_regs|tenancy_law|tax_changes|licensing|planning|other",
      "severity": "info|warning|critical",
      "summary": "2-3 sentence summary of the change",
      "details": "Full explanation of what changed, who is affected, and timeline",
      "source_url": "URL to legislation or official guidance if known",
      "effective_date": "YYYY-MM-DD or null if unknown",
      "affects_property_types": ["HMO", "BTL", "SA", "Commercial"],
      "recommended_actions": ["Action 1", "Action 2"]
    }
  ]
}

Categories:
- housing_act: Housing Act amendments, Renters Reform Bill
- hmo_regs: HMO licensing, room sizes, amenity standards
- fire_safety: Fire Safety Act, Building Safety Act, alarm regs
- epc_regs: EPC minimum ratings, MEES changes
- tenancy_law: Section 21/8, tenancy reforms, deposit rules, Awaab's Law
- tax_changes: SDLT, CGT, income tax for landlords
- licensing: Selective licensing, additional licensing schemes
- planning: Planning law, permitted development, Article 4
- other: Anything else

Current date: ${currentDate}
Return 5-10 relevant alerts sorted by severity (critical first).`;

      const userPrompt = `Scan for UK regulatory changes affecting a property portfolio with these characteristics:
- Property types: ${propertyTypes.length > 0 ? propertyTypes.join(", ") : "HMO, BTL"}
- Local authorities: ${councils.length > 0 ? councils.slice(0, 10).join(", ") : "Various UK councils"}
- Current date: ${currentDate}

Focus on changes from the last 6 months and upcoming deadlines in the next 12 months. Include both enacted legislation and confirmed upcoming changes.`;

      log.info("Sending to AI gateway", { orgId });

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
        const errorText = await response.text();
        log.error("AI gateway error", { orgId, status: response.status, body: errorText.slice(0, 200) });
        continue; // Skip this org but continue with others
      }

      const aiResponse = await response.json();
      const content = aiResponse.choices?.[0]?.message?.content;

      if (!content) {
        log.warn("No content in AI response", { orgId });
        continue;
      }

      // Parse JSON from response (handle markdown code blocks)
      let parsed: { alerts?: unknown[] };
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
          if (jsonStart !== -1) jsonStr = jsonStr.slice(jsonStart);
        }
        parsed = JSON.parse(jsonStr.trim());
      } catch {
        log.error("Failed to parse AI response", { orgId, content: content.slice(0, 300) });
        continue;
      }

      const alerts = Array.isArray(parsed.alerts) ? parsed.alerts : [];
      log.info("Parsed alerts", { orgId, count: alerts.length });

      // Insert new alerts, skipping duplicates (unique index handles conflicts)
      for (const raw of alerts) {
        const alert = sanitizeAlert(raw as Record<string, unknown>);
        if (!alert) continue;

        const { error: insertError } = await supabase
          .from("regulatory_alerts")
          .upsert(
            {
              org_id: orgId,
              title: alert.title,
              category: alert.category,
              severity: alert.severity,
              summary: alert.summary,
              details: alert.details,
              source_url: alert.source_url,
              effective_date: alert.effective_date,
              affects_property_types: alert.affects_property_types,
              recommended_actions: alert.recommended_actions,
            },
            { onConflict: "org_id,title,effective_date", ignoreDuplicates: true }
          );

        if (insertError) {
          log.warn("Insert failed", { orgId, title: alert.title, error: insertError.message });
        } else {
          totalInserted++;
        }
      }
    }

    log.info("Regulatory check completed", { totalInserted, orgCount: authorization.orgIds.length });

    return new Response(
      JSON.stringify({
        success: true,
        alertsInserted: totalInserted,
        orgsProcessed: authorization.orgIds.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("Regulatory check error", { error: message });

    if (message === "Unauthorized") {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
