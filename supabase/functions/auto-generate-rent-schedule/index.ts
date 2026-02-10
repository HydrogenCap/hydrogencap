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
        const periodEndStr = periodEnd.toISOString().split("T")[0];

        // Generate payment reference
        const prefix = "HYD";
        const letters = Array.from({ length: 3 }, () =>
          String.fromCharCode(65 + Math.floor(Math.random() * 26))
        ).join("");
        const numbers = Math.floor(Math.random() * 100).toString().padStart(2, "0");
        const paymentReference = `${prefix}-${letters}${numbers}`;

        // Determine status based on date
        const status = dueDate <= now ? "due" : "upcoming";

        const { error: insertError } = await supabase
          .from("rent_schedule")
          .insert({
            org_id: tenancy.org_id,
            tenancy_id: tenancy.id,
            due_date: dueDateStr,
            period_start: dueDateStr,
            period_end: periodEndStr,
            rent_amount: tenancy.rent_amount_pcm,
            additional_charges: 0,
            amount_paid: 0,
            amount_outstanding: tenancy.rent_amount_pcm,
            status,
            payment_reference: paymentReference,
          });

        if (!insertError) created++;
        else console.error("Insert error:", insertError);
      }
    }

    // Also update past-due 'upcoming' items to 'due' or 'overdue'
    const todayStr = now.toISOString().split("T")[0];

    await supabase
      .from("rent_schedule")
      .update({ status: "overdue" })
      .eq("status", "upcoming")
      .lt("due_date", todayStr);

    await supabase
      .from("rent_schedule")
      .update({ status: "due" })
      .eq("status", "upcoming")
      .eq("due_date", todayStr);

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
