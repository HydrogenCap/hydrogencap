import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active tenancies with rent details
    const { data: tenancies, error: tenError } = await supabase
      .from("tenancies")
      .select("id, org_id, property_id, room_id, rent_amount_pcm, rent_due_day, start_date, end_date, status")
      .eq("status", "active");

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

    // Generate schedule items for current month and next month
    for (const tenancy of tenancies) {
      if (!tenancy.rent_amount_pcm || tenancy.rent_amount_pcm <= 0) continue;

      const dueDay = tenancy.rent_due_day || 1;

      for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
        const targetMonth = currentMonth + monthOffset;
        const targetYear = currentYear + Math.floor(targetMonth / 12);
        const normalizedMonth = targetMonth % 12;

        // Calculate due date (clamp day to max days in month)
        const maxDays = new Date(targetYear, normalizedMonth + 1, 0).getDate();
        const clampedDay = Math.min(dueDay, maxDays);
        const dueDate = new Date(targetYear, normalizedMonth, clampedDay);
        const dueDateStr = dueDate.toISOString().split("T")[0];

        // Skip if due date is before tenancy start or after end
        if (tenancy.start_date && dueDateStr < tenancy.start_date) continue;
        if (tenancy.end_date && dueDateStr > tenancy.end_date) continue;

        // Check if schedule item already exists for this tenancy+due_date
        const { data: existing } = await supabase
          .from("rent_schedule")
          .select("id")
          .eq("tenancy_id", tenancy.id)
          .eq("due_date", dueDateStr)
          .limit(1);

        if (existing && existing.length > 0) continue;

        // Calculate period start/end
        const periodStart = new Date(targetYear, normalizedMonth, clampedDay);
        const periodEnd = new Date(targetYear, normalizedMonth + 1, clampedDay - 1);

        // Adjust for pro-rata: first period starts at tenancy start, last period ends at tenancy end
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

        // Pro-rata calculation
        const fullPeriodDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const actualDays = Math.round((actualPeriodEnd.getTime() - actualPeriodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const isProRata = actualDays < fullPeriodDays;
        const rentAmount = isProRata
          ? Math.round((tenancy.rent_amount_pcm * actualDays / fullPeriodDays) * 100) / 100
          : tenancy.rent_amount_pcm;

        // Generate payment reference
        const prefix = "HYD";
        const letters = Array.from({ length: 3 }, () =>
          String.fromCharCode(65 + Math.floor(Math.random() * 26))
        ).join("");
        const numbers = Math.floor(Math.random() * 100).toString().padStart(2, "0");
        const paymentReference = `${prefix}-${letters}${numbers}`;

        // Use upsert to avoid duplicates (unique index on tenancy_id, due_date)
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
          }, { onConflict: 'tenancy_id,due_date', ignoreDuplicates: true });

        if (!insertError) created++;
        else console.error("Insert error:", insertError);
      }
    }

    // Update past-due statuses via DB function (avoids enum type mismatch)
    await supabase.rpc("update_rent_schedule_statuses");

    return new Response(
      JSON.stringify({ success: true, created, message: `Generated ${created} schedule items` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
