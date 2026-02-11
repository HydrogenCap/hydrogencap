import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body = rawBody as Record<string, unknown>;
    const rentScheduleId = typeof body.rentScheduleId === "string" ? body.rentScheduleId : null;
    const tenancyId = typeof body.tenancyId === "string" ? body.tenancyId : null;
    const reminderType = typeof body.reminderType === "string" ? body.reminderType : null;
    const customMessage = typeof body.customMessage === "string" ? body.customMessage.slice(0, 5000) : undefined;

    const validReminderTypes = ["pre_due", "due_date", "overdue"];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!rentScheduleId || !uuidRegex.test(rentScheduleId)) {
      return new Response(JSON.stringify({ error: "Invalid or missing rentScheduleId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    if (!tenancyId || !uuidRegex.test(tenancyId)) {
      return new Response(JSON.stringify({ error: "Invalid or missing tenancyId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    if (!reminderType || !validReminderTypes.includes(reminderType)) {
      return new Response(JSON.stringify({ error: "Invalid reminderType. Must be: pre_due, due_date, or overdue" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Get schedule item with tenant info
    const { data: scheduleItem, error: scheduleError } = await supabase
      .from("rent_schedule")
      .select("id, due_date, rent_amount, amount_outstanding, payment_reference")
      .eq("id", rentScheduleId)
      .single();
    if (scheduleError || !scheduleItem) throw new Error("Rent schedule item not found");

    // Get tenancy with tenant and property
    const { data: tenancy, error: tenancyError } = await supabase
      .from("tenancies")
      .select(`
        id,
        tenant:tenants(id, first_name, last_name, email, phone),
        property:properties(id, address_line, postcode)
      `)
      .eq("id", tenancyId)
      .single();
    if (tenancyError || !tenancy) throw new Error("Tenancy not found");

    const tenant = (tenancy as any).tenant;
    const property = (tenancy as any).property;

    if (!tenant?.email) throw new Error("Tenant has no email address");

    const tenantName = `${tenant.first_name} ${tenant.last_name}`;
    const propertyAddress = `${property.address_line}${property.postcode ? `, ${property.postcode}` : ""}`;
    const amount = scheduleItem.amount_outstanding || scheduleItem.rent_amount;

    // Build email subject and body
    const dueDate = new Date(scheduleItem.due_date);
    const now = new Date();
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    let subject: string;
    let body: string;

    if (customMessage) {
      subject = reminderType === "overdue"
        ? `URGENT: Overdue Rent Payment — ${propertyAddress}`
        : reminderType === "due_date"
        ? `Rent Payment Due Today — ${propertyAddress}`
        : `Upcoming Rent Payment — ${propertyAddress}`;
      body = customMessage.replace(/\n/g, "<br>");
    } else {
      switch (reminderType) {
        case "overdue":
          subject = `URGENT: Overdue Rent Payment — ${propertyAddress}`;
          body = `
            <p>Dear ${tenantName},</p>
            <p>Your rent payment of <strong>£${amount.toLocaleString()}</strong> is now <strong>${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}</strong> overdue.</p>
            <p>Please contact us immediately to arrange payment or discuss a payment plan.</p>
            <p><strong>Outstanding Amount:</strong> £${amount.toLocaleString()}<br>
            <strong>Original Due Date:</strong> ${formatDate(dueDate)}</p>
            <p>Thank you</p>`;
          break;
        case "due_date":
          subject = `Rent Payment Due Today — ${propertyAddress}`;
          body = `
            <p>Dear ${tenantName},</p>
            <p>Your rent payment of <strong>£${amount.toLocaleString()}</strong> is due today.</p>
            <p>Please make payment as soon as possible.</p>
            <p>Thank you</p>`;
          break;
        default:
          subject = `Upcoming Rent Payment — ${propertyAddress}`;
          body = `
            <p>Dear ${tenantName},</p>
            <p>This is a friendly reminder that your rent payment of <strong>£${amount.toLocaleString()}</strong> will be due on <strong>${formatDate(dueDate)}</strong>.</p>
            <p>Please ensure payment is made on time.</p>
            <p>Thank you</p>`;
      }
    }

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        ${body}
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #888; font-size: 12px;">This email was sent automatically by HydrogenCap property management.</p>
      </div>`;

    const emailResult = await resend.emails.send({
      from: "HydrogenCap <onboarding@resend.dev>",
      to: [tenant.email],
      subject,
      html: emailHtml,
    });

    console.log("Reminder email sent:", emailResult);

    // Get org_id
    const { data: orgData } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (orgData?.org_id) {
      // Record reminder
      await supabase.from("payment_reminders").insert({
        org_id: orgData.org_id,
        rent_schedule_id: rentScheduleId,
        tenancy_id: tenancyId,
        reminder_type: reminderType,
        recipient_email: tenant.email,
        recipient_name: tenantName,
        status: "sent",
        resend_id: emailResult?.data?.id || null,
      });

      // Update rent_schedule reminder tracking
      const updateField = reminderType === "overdue" ? "warning_sent_at" : "reminder_sent_at";
      await supabase.from("rent_schedule").update({ [updateField]: new Date().toISOString() }).eq("id", rentScheduleId);

      // Log activity
      await supabase.from("activity_log").insert({
        org_id: orgData.org_id,
        property_id: property.id,
        entry_type: "rent_reminder_sent",
        title: `${reminderType.replace("_", " ")} reminder sent to ${tenantName}`,
        body: `Rent reminder for £${amount.toLocaleString()} sent to ${tenant.email}`,
        metadata: { tenancy_id: tenancyId, reminder_type: reminderType, resend_id: emailResult?.data?.id },
      });
    }

    return new Response(
      JSON.stringify({ success: true, sentTo: tenant.email, resendId: emailResult?.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

function formatDate(date: Date): string {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}
