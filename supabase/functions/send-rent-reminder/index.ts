import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { validateBody } from "../_shared/validate.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

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

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const rateLimit = await checkRateLimit(user.id, 'send-rent-reminder', 50, 60);
    if (!rateLimit.allowed) return rateLimitResponse(corsHeaders, rateLimit.remaining, rateLimit.resetAt);

    const ReminderSchema = z.object({
      rentScheduleId: z.string().uuid("Invalid rentScheduleId"),
      tenancyId: z.string().uuid("Invalid tenancyId"),
      reminderType: z.enum(["pre_due", "due_date", "overdue"], {
        errorMap: () => ({ message: "Must be: pre_due, due_date, or overdue" }),
      }),
      customMessage: z.string().max(5000).optional(),
    });

    const parsed = await validateBody(req, ReminderSchema, corsHeaders);
    if ("error" in parsed) return parsed.error;
    const { rentScheduleId, tenancyId, reminderType, customMessage } = parsed.data;

    const { data: scheduleItem, error: scheduleError } = await supabase
      .from("rent_schedule")
      .select("id, org_id, tenancy_id, due_date, rent_amount, amount_outstanding, payment_reference")
      .eq("id", rentScheduleId)
      .single();
    if (scheduleError || !scheduleItem) throw new Error("Rent schedule item not found");
    if (scheduleItem.tenancy_id !== tenancyId) throw new Error("Rent schedule does not match tenancy");

    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id, role")
      .eq("user_id", user.id)
      .eq("org_id", scheduleItem.org_id)
      .maybeSingle();

    if (!membership?.org_id) throw new Error("Access denied");
    if (membership.role === "viewer") throw new Error("Viewers cannot send rent reminders");

    const { data: tenancy, error: tenancyError } = await supabase
      .from("tenancies")
      .select(`
        id,
        org_id,
        tenant:tenants(id, first_name, last_name, email, phone),
        property:properties(id, address_line, postcode)
      `)
      .eq("id", tenancyId)
      .single();
    if (tenancyError || !tenancy) throw new Error("Tenancy not found");
    if (tenancy.org_id !== membership.org_id) throw new Error("Access denied");

    const tenancyRelations = tenancy as unknown as {
      tenant:
        | { first_name: string; last_name: string; email: string | null }
        | Array<{ first_name: string; last_name: string; email: string | null }>;
      property:
        | { id: string; address_line: string; postcode: string | null }
        | Array<{ id: string; address_line: string; postcode: string | null }>;
    };
    const tenant = Array.isArray(tenancyRelations.tenant)
      ? tenancyRelations.tenant[0]
      : tenancyRelations.tenant;
    const property = Array.isArray(tenancyRelations.property)
      ? tenancyRelations.property[0]
      : tenancyRelations.property;

    if (!tenant?.email) throw new Error("Tenant has no email address");

    const tenantName = `${tenant.first_name} ${tenant.last_name}`;
    const propertyAddress = `${property.address_line}${property.postcode ? `, ${property.postcode}` : ""}`;
    const amount = scheduleItem.amount_outstanding || scheduleItem.rent_amount;

    const dueDate = new Date(scheduleItem.due_date);
    const now = new Date();
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    let subject: string;
    let body: string;

    if (customMessage) {
      subject = reminderType === "overdue"
        ? `URGENT: Overdue Rent Payment - ${propertyAddress}`
        : reminderType === "due_date"
        ? `Rent Payment Due Today - ${propertyAddress}`
        : `Upcoming Rent Payment - ${propertyAddress}`;
      body = customMessage.replace(/\n/g, "<br>");
    } else {
      switch (reminderType) {
        case "overdue":
          subject = `URGENT: Overdue Rent Payment - ${propertyAddress}`;
          body = `
            <p>Dear ${tenantName},</p>
            <p>Your rent payment of <strong>GBP ${amount.toLocaleString()}</strong> is now <strong>${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}</strong> overdue.</p>
            <p>Please contact us immediately to arrange payment or discuss a payment plan.</p>
            <p><strong>Outstanding Amount:</strong> GBP ${amount.toLocaleString()}<br>
            <strong>Original Due Date:</strong> ${formatDate(dueDate)}</p>
            <p>Thank you</p>`;
          break;
        case "due_date":
          subject = `Rent Payment Due Today - ${propertyAddress}`;
          body = `
            <p>Dear ${tenantName},</p>
            <p>Your rent payment of <strong>GBP ${amount.toLocaleString()}</strong> is due today.</p>
            <p>Please make payment as soon as possible.</p>
            <p>Thank you</p>`;
          break;
        default:
          subject = `Upcoming Rent Payment - ${propertyAddress}`;
          body = `
            <p>Dear ${tenantName},</p>
            <p>This is a friendly reminder that your rent payment of <strong>GBP ${amount.toLocaleString()}</strong> will be due on <strong>${formatDate(dueDate)}</strong>.</p>
            <p>Please ensure payment is made on time.</p>
            <p>Thank you</p>`;
      }
    }

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        ${body}
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #888; font-size: 12px;">This email was sent automatically by Tenure IQ property management.</p>
      </div>`;

    const emailResult = await resend.emails.send({
      from: "Tenure IQ <onboarding@resend.dev>",
      to: [tenant.email],
      subject,
      html: emailHtml,
    });

    await supabase.from("payment_reminders").insert({
      org_id: membership.org_id,
      rent_schedule_id: rentScheduleId,
      tenancy_id: tenancyId,
      reminder_type: reminderType,
      recipient_email: tenant.email,
      recipient_name: tenantName,
      status: "sent",
      resend_id: emailResult?.data?.id || null,
    });

    const updateField = reminderType === "overdue" ? "warning_sent_at" : "reminder_sent_at";
    await supabase
      .from("rent_schedule")
      .update({ [updateField]: new Date().toISOString() })
      .eq("id", rentScheduleId);

    await supabase.from("activity_log").insert({
      org_id: membership.org_id,
      property_id: property.id,
      entry_type: "rent_reminder_sent",
      title: `${reminderType.replace("_", " ")} reminder sent to ${tenantName}`,
      body: `Rent reminder for GBP ${amount.toLocaleString()} sent to ${tenant.email}`,
      metadata: { tenancy_id: tenancyId, reminder_type: reminderType, resend_id: emailResult?.data?.id },
    });

    return new Response(
      JSON.stringify({ success: true, sentTo: tenant.email, resendId: emailResult?.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});

function formatDate(date: Date): string {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}
