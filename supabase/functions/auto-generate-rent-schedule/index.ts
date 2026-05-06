import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { withInvocationLog } from "../_shared/logger.ts";
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

serve(withInvocationLog("auto-generate-rent-schedule", async (req: Request, _invocationLog) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("Authorization");

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Cron authorization required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rawTenancies, error: tenError } = await supabase
      .from("tenancy_agreements")
      .select("id, org_id, property_id, room_id, rent_amount_pcm, rent_due_day, start_date, initial_end_date, actual_end_date, status")
      .eq("status", "active");
    const tenancies = (rawTenancies ?? []).map((t: any) => ({
      ...t,
      end_date: t.actual_end_date ?? t.initial_end_date ?? null,
    }));

    if (tenError) throw tenError;
    if (!tenancies || tenancies.length === 0) {
      return new Response(JSON.stringify({ created: 0, message: "No active tenancies" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let created = 0;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    for (const tenancy of tenancies) {
      if (!tenancy.rent_amount_pcm || tenancy.rent_amount_pcm <= 0) continue;

      const dueDay = tenancy.rent_due_day || 1;

      for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
        const targetMonth = currentMonth + monthOffset;
        const targetYear = currentYear + Math.floor(targetMonth / 12);
        const normalizedMonth = targetMonth % 12;

        const maxDays = new Date(targetYear, normalizedMonth + 1, 0).getDate();
        const clampedDay = Math.min(dueDay, maxDays);
        const dueDate = new Date(targetYear, normalizedMonth, clampedDay);
        const dueDateStr = dueDate.toISOString().split("T")[0];

        if (tenancy.start_date && dueDateStr < tenancy.start_date) continue;
        if (tenancy.end_date && dueDateStr > tenancy.end_date) continue;

        const { data: existing } = await supabase
          .from("rent_schedule")
          .select("id")
          .eq("tenancy_id", tenancy.id)
          .eq("due_date", dueDateStr)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const periodStart = new Date(targetYear, normalizedMonth, clampedDay);
        const periodEnd = new Date(targetYear, normalizedMonth + 1, clampedDay - 1);

        let actualPeriodStart = periodStart;
        let actualPeriodEnd = periodEnd;

        if (tenancy.start_date) {
          const tenancyStart = new Date(tenancy.start_date);
          if (tenancyStart > periodStart && tenancyStart <= periodEnd) {
            actualPeriodStart = tenancyStart;
          }
        }

        if (tenancy.end_date) {
          const tenancyEnd = new Date(tenancy.end_date);
          if (tenancyEnd >= periodStart && tenancyEnd < periodEnd) {
            actualPeriodEnd = tenancyEnd;
          }
        }

        const actualPeriodStartStr = actualPeriodStart.toISOString().split("T")[0];
        const actualPeriodEndStr = actualPeriodEnd.toISOString().split("T")[0];

        const fullPeriodDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const actualDays = Math.round((actualPeriodEnd.getTime() - actualPeriodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const isProRata = actualDays < fullPeriodDays;
        const rentAmount = isProRata
          ? Math.round((tenancy.rent_amount_pcm * actualDays / fullPeriodDays) * 100) / 100
          : tenancy.rent_amount_pcm;

        const prefix = "HYD";
        const letters = Array.from({ length: 3 }, () =>
          String.fromCharCode(65 + Math.floor(Math.random() * 26))
        ).join("");
        const numbers = Math.floor(Math.random() * 100).toString().padStart(2, "0");
        const paymentReference = `${prefix}-${letters}${numbers}`;

        const { error: insertError } = await supabase
          .from("rent_schedule")
          .upsert({
            org_id: tenancy.org_id,
            tenancy_id: tenancy.id,
            due_date: dueDateStr,
            period_start: actualPeriodStartStr,
            period_end: actualPeriodEndStr,
            rent_amount: rentAmount,
            additional_charges: 0,
            amount_paid: 0,
            amount_outstanding: rentAmount,
            payment_reference: paymentReference,
          }, { onConflict: "tenancy_id,due_date", ignoreDuplicates: true });

        if (!insertError) created++;
        else console.error("Insert error:", insertError);
      }
    }

    await supabase.rpc("update_rent_schedule_statuses");

    return new Response(
      JSON.stringify({ success: true, created, message: `Generated ${created} schedule items` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}));
