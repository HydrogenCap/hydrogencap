import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { requireActiveSubscription } from "../_shared/checkSubscription.ts";
import { createLogger, withInvocationLog } from "../_shared/logger.ts";

interface PaymentPattern {
  tenantId: string;
  tenantName: string;
  propertyId: string;
  propertyAddress: string;
  roomId: string | null;
  totalScheduled: number;
  totalPaid: number;
  latePayments: number;
  onTimePayments: number;
  missedPayments: number;
  partialPayments: number;
  avgDaysLate: number;
  maxDaysLate: number;
  paymentGaps: number;
  recentTrend: "improving" | "stable" | "worsening";
  lastPaymentDate: string | null;
  monthsOfData: number;
}

serve(withInvocationLog("predict-arrears", async (req, log) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const log = createLogger("predict-arrears", req);

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

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log.withUser(userData.user.id);

    // Subscription check
    const subCheck = await requireActiveSubscription(userData.user.id, corsHeaders);
    if (!subCheck.allowed) return subCheck.response;

    // Rate limit: 10 predictions per hour
    const rateLimit = await checkRateLimit(userData.user.id, "predict-arrears", 10, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(corsHeaders, rateLimit.remaining, rateLimit.resetAt);
    }

    // Parse optional property_id filter from body
    let propertyIdFilter: string | null = null;
    try {
      const body = await req.json();
      propertyIdFilter = body?.property_id ?? null;
    } catch {
      // No body or invalid JSON — that's fine, process all properties
    }

    // Get user's org_id
    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", userData.user.id)
      .limit(1)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "No organization found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = membership.org_id;
    log.info("Starting arrears prediction", { orgId, propertyIdFilter });

    // Fetch rent schedules with tenant/property details
    let scheduleQuery = supabase
      .from("rent_schedules")
      .select(`
        id, tenancy_id, due_date, rent_amount, amount_paid, amount_outstanding, status,
        tenancy:tenancies!inner(
          id,
          tenant:tenants!inner(id, first_name, last_name),
          room:rooms(id, room_name),
          property:properties!inner(id, address_line, postcode)
        )
      `)
      .order("due_date", { ascending: false });

    if (propertyIdFilter) {
      scheduleQuery = scheduleQuery.eq("tenancy.property.id", propertyIdFilter);
    }

    const { data: schedules, error: schedError } = await scheduleQuery;

    if (schedError) {
      log.error("Failed to fetch rent schedules", { error: schedError.message });
      return new Response(JSON.stringify({ error: "Failed to fetch rent data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ predictions: [], message: "No rent data found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by tenant and analyse payment patterns
    const tenantMap = new Map<string, typeof schedules>();
    for (const sched of schedules) {
      const tenantId = (sched.tenancy as any)?.tenant?.id;
      if (!tenantId) continue;
      if (!tenantMap.has(tenantId)) tenantMap.set(tenantId, []);
      tenantMap.get(tenantId)!.push(sched);
    }

    const patterns: PaymentPattern[] = [];

    for (const [tenantId, items] of tenantMap.entries()) {
      const firstItem = items[0];
      const tenancy = firstItem.tenancy as any;
      const tenant = tenancy?.tenant;
      const property = tenancy?.property;
      const room = tenancy?.room;

      if (!tenant || !property) continue;

      const now = new Date();
      const pastItems = items.filter((i) => new Date(i.due_date) <= now);
      const totalScheduled = pastItems.length;

      if (totalScheduled === 0) continue;

      let latePayments = 0;
      let onTimePayments = 0;
      let missedPayments = 0;
      let partialPayments = 0;
      let totalDaysLate = 0;
      let maxDaysLate = 0;
      let paymentGaps = 0;
      let lastPaymentDate: string | null = null;

      for (const item of pastItems) {
        const status = item.status as string;
        if (status === "paid") {
          // Check if it was late (amount_outstanding was 0 but paid after due date)
          onTimePayments++;
          if (!lastPaymentDate || item.due_date > lastPaymentDate) {
            lastPaymentDate = item.due_date;
          }
        } else if (status === "partial") {
          partialPayments++;
          latePayments++;
        } else if (status === "overdue" || status === "bad_debt") {
          missedPayments++;
          const daysLate = Math.floor(
            (now.getTime() - new Date(item.due_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          totalDaysLate += daysLate;
          maxDaysLate = Math.max(maxDaysLate, daysLate);
        } else if (status === "due") {
          // Due but not yet overdue — check if near deadline
          const daysToDue = Math.floor(
            (new Date(item.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysToDue < 0) {
            latePayments++;
            totalDaysLate += Math.abs(daysToDue);
            maxDaysLate = Math.max(maxDaysLate, Math.abs(daysToDue));
          }
        }
      }

      // Detect payment gaps (consecutive missed months)
      const sortedDates = pastItems
        .map((i) => new Date(i.due_date))
        .sort((a, b) => a.getTime() - b.getTime());

      for (let i = 1; i < sortedDates.length; i++) {
        const gapDays =
          (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
        if (gapDays > 45) paymentGaps++;
      }

      // Determine recent trend from last 3 months
      const recentItems = pastItems
        .filter((i) => {
          const monthsAgo =
            (now.getTime() - new Date(i.due_date).getTime()) / (1000 * 60 * 60 * 24 * 30);
          return monthsAgo <= 3;
        })
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

      const olderItems = pastItems.filter((i) => {
        const monthsAgo =
          (now.getTime() - new Date(i.due_date).getTime()) / (1000 * 60 * 60 * 24 * 30);
        return monthsAgo > 3 && monthsAgo <= 6;
      });

      const recentPaidRate =
        recentItems.length > 0
          ? recentItems.filter((i) => i.status === "paid").length / recentItems.length
          : 1;
      const olderPaidRate =
        olderItems.length > 0
          ? olderItems.filter((i) => i.status === "paid").length / olderItems.length
          : 1;

      let recentTrend: "improving" | "stable" | "worsening" = "stable";
      if (recentPaidRate > olderPaidRate + 0.15) recentTrend = "improving";
      else if (recentPaidRate < olderPaidRate - 0.15) recentTrend = "worsening";

      const monthsOfData = Math.max(
        1,
        Math.ceil(
          (now.getTime() - sortedDates[0].getTime()) / (1000 * 60 * 60 * 24 * 30)
        )
      );

      const totalPaid = pastItems.reduce((sum, i) => sum + (i.amount_paid ?? 0), 0);

      const avgDaysLate =
        latePayments + missedPayments > 0
          ? Math.round(totalDaysLate / (latePayments + missedPayments))
          : 0;

      patterns.push({
        tenantId,
        tenantName: `${tenant.first_name} ${tenant.last_name}`,
        propertyId: property.id,
        propertyAddress: `${property.address_line}${property.postcode ? `, ${property.postcode}` : ""}`,
        roomId: room?.id ?? null,
        totalScheduled,
        totalPaid,
        latePayments,
        onTimePayments,
        missedPayments,
        partialPayments,
        avgDaysLate,
        maxDaysLate,
        paymentGaps,
        recentTrend,
        lastPaymentDate,
        monthsOfData,
      });
    }

    if (patterns.length === 0) {
      return new Response(JSON.stringify({ predictions: [], message: "No tenant payment data to analyse" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build AI prompt
    const patternSummary = patterns
      .map(
        (p) =>
          `Tenant: ${p.tenantName} | Property: ${p.propertyAddress}
  - ${p.monthsOfData} months of data, ${p.totalScheduled} scheduled payments
  - On-time: ${p.onTimePayments}, Late: ${p.latePayments}, Missed: ${p.missedPayments}, Partial: ${p.partialPayments}
  - Avg days late: ${p.avgDaysLate}, Max days late: ${p.maxDaysLate}
  - Payment gaps: ${p.paymentGaps}
  - Recent trend: ${p.recentTrend}
  - Last payment: ${p.lastPaymentDate ?? "Never"}`
      )
      .join("\n\n");

    const aiPrompt = `You are an expert UK property rent arrears analyst. Analyse these tenant payment patterns and assess the risk of arrears in the next 30 days.

For EACH tenant below, provide:
1. risk_score: A number from 0.00 (no risk) to 1.00 (certain arrears)
2. risk_level: "low" (0-0.25), "medium" (0.26-0.50), "high" (0.51-0.75), or "critical" (0.76-1.00)
3. contributing_factors: Array of objects with "factor" (short description) and "weight" (impact 1-5)
4. recommended_actions: Array of action strings the landlord should take

Payment patterns:
${patternSummary}

Respond with ONLY valid JSON in this exact format:
{
  "predictions": [
    {
      "tenant_name": "...",
      "risk_score": 0.00,
      "risk_level": "low",
      "contributing_factors": [{"factor": "...", "weight": 1}],
      "recommended_actions": ["..."]
    }
  ]
}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      log.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log.info("Calling AI gateway", { tenantCount: patterns.length });

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an expert UK property rent arrears risk analyst. Respond only with valid JSON.",
          },
          { role: "user", content: aiPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      log.error("AI gateway error", { status: aiResponse.status, error: errorText });

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      log.error("Empty AI response");
      return new Response(JSON.stringify({ error: "AI returned empty response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse AI response — handle markdown code fences
    let aiPredictions: any;
    try {
      const cleaned = aiContent.replace(/```json\s*\n?/g, "").replace(/```\s*$/g, "").trim();
      aiPredictions = JSON.parse(cleaned);
    } catch (parseErr) {
      log.error("Failed to parse AI response", { content: aiContent.slice(0, 500) });
      return new Response(JSON.stringify({ error: "Failed to parse AI prediction" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Match AI predictions back to tenant patterns and save to DB
    const predictions: any[] = [];
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Delete old predictions for this org (keep latest run only)
    await adminClient
      .from("arrears_predictions")
      .delete()
      .eq("org_id", orgId);

    for (const aiPred of aiPredictions.predictions ?? []) {
      // Match by tenant name
      const pattern = patterns.find(
        (p) => p.tenantName.toLowerCase() === aiPred.tenant_name?.toLowerCase()
      );

      if (!pattern) continue;

      const riskScore = Math.min(1, Math.max(0, Number(aiPred.risk_score) || 0));
      const validLevels = ["low", "medium", "high", "critical"];
      const riskLevel = validLevels.includes(aiPred.risk_level) ? aiPred.risk_level : "medium";

      const prediction = {
        org_id: orgId,
        tenant_id: pattern.tenantId,
        property_id: pattern.propertyId,
        room_id: pattern.roomId,
        risk_score: riskScore.toFixed(2),
        risk_level: riskLevel,
        contributing_factors: Array.isArray(aiPred.contributing_factors)
          ? aiPred.contributing_factors
          : [],
        recommended_actions: Array.isArray(aiPred.recommended_actions)
          ? aiPred.recommended_actions
          : [],
        prediction_period: "next_30_days",
        model_version: "v1",
      };

      predictions.push(prediction);
    }

    if (predictions.length > 0) {
      const { error: insertError } = await adminClient
        .from("arrears_predictions")
        .insert(predictions);

      if (insertError) {
        log.error("Failed to save predictions", { error: insertError.message });
      }
    }

    log.info("Prediction complete", {
      tenantCount: patterns.length,
      predictionCount: predictions.length,
    });

    return new Response(
      JSON.stringify({
        predictions,
        summary: {
          total: predictions.length,
          critical: predictions.filter((p) => p.risk_level === "critical").length,
          high: predictions.filter((p) => p.risk_level === "high").length,
          medium: predictions.filter((p) => p.risk_level === "medium").length,
          low: predictions.filter((p) => p.risk_level === "low").length,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    log.error("Prediction failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}));
