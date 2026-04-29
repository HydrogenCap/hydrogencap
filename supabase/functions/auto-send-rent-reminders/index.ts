import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@4.0.0";

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

serve(withInvocationLog("auto-send-rent-reminders", async (req: Request, _invocationLog) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // This function performs cross-org automated sends and should only run on cron.
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("Authorization");

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      // Authorized as cron job
    } else {
      return new Response(JSON.stringify({ error: "Cron authorization required" }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const resend = new Resend(resendKey);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    let sent = 0;

    // 1. Pre-due reminders: 7 days before, not yet reminded
    const { data: preDueItems } = await supabase
      .from("rent_schedule")
      .select(`
        id, org_id, tenancy_id, due_date, rent_amount, amount_outstanding, payment_reference,
        tenancy:tenancies(
          id,
          tenant:tenants(id, first_name, last_name, email),
          property:properties(id, address_line, postcode)
        )
      `)
      .eq("status", "upcoming")
      .eq("due_date", sevenDaysFromNow)
      .is("reminder_sent_at", null);

    for (const item of preDueItems || []) {
      const tenant = (item as any).tenancy?.tenant;
      const property = (item as any).tenancy?.property;
      if (!tenant?.email) continue;

      const tenantName = `${tenant.first_name} ${tenant.last_name}`;
      const address = `${property.address_line}${property.postcode ? `, ${property.postcode}` : ""}`;

      try {
        await resend.emails.send({
          from: "Tenure IQ <onboarding@resend.dev>",
          to: [tenant.email],
          subject: `Upcoming Rent Payment — ${address}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <p>Dear ${tenantName},</p>
            <p>This is a friendly reminder that your rent payment of <strong>£${item.amount_outstanding}</strong> will be due on <strong>${item.due_date}</strong>.</p>
            <p>Please ensure payment is made on time.</p>
            <p>Thank you</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
            <p style="color:#888;font-size:12px">Sent automatically by Tenure IQ.</p>
          </div>`,
        });

        await supabase.from("payment_reminders").insert({
          org_id: item.org_id,
          rent_schedule_id: item.id,
          tenancy_id: item.tenancy_id,
          reminder_type: "pre_due",
          recipient_email: tenant.email,
          recipient_name: tenantName,
          status: "sent",
        });

        await supabase.from("rent_schedule").update({ reminder_sent_at: now.toISOString() }).eq("id", item.id);
        sent++;
      } catch (e) {
        console.error("Pre-due email failed:", e);
      }
    }

    // 2. Due-date reminders: on the due date, not yet reminded today
    const { data: dueItems } = await supabase
      .from("rent_schedule")
      .select(`
        id, org_id, tenancy_id, due_date, rent_amount, amount_outstanding, payment_reference,
        tenancy:tenancies(
          id,
          tenant:tenants(id, first_name, last_name, email),
          property:properties(id, address_line, postcode)
        )
      `)
      .in("status", ["due", "upcoming"])
      .eq("due_date", todayStr)
      .is("warning_sent_at", null);

    for (const item of dueItems || []) {
      const tenant = (item as any).tenancy?.tenant;
      const property = (item as any).tenancy?.property;
      if (!tenant?.email) continue;

      const tenantName = `${tenant.first_name} ${tenant.last_name}`;
      const address = `${property.address_line}${property.postcode ? `, ${property.postcode}` : ""}`;

      try {
        await resend.emails.send({
          from: "Tenure IQ <onboarding@resend.dev>",
          to: [tenant.email],
          subject: `Rent Payment Due Today — ${address}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <p>Dear ${tenantName},</p>
            <p>Your rent payment of <strong>£${item.amount_outstanding}</strong> is due today.</p>
            <p>Please make payment as soon as possible.</p>
            <p>Thank you</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
            <p style="color:#888;font-size:12px">Sent automatically by Tenure IQ.</p>
          </div>`,
        });

        await supabase.from("payment_reminders").insert({
          org_id: item.org_id,
          rent_schedule_id: item.id,
          tenancy_id: item.tenancy_id,
          reminder_type: "due_date",
          recipient_email: tenant.email,
          recipient_name: tenantName,
          status: "sent",
        });

        await supabase.from("rent_schedule").update({ warning_sent_at: now.toISOString() }).eq("id", item.id);
        sent++;
      } catch (e) {
        console.error("Due-date email failed:", e);
      }
    }

    // 3. Overdue reminders: 3+ days overdue, not warned in last 7 days
    const sevenDaysAgoStr = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: overdueItems } = await supabase
      .from("rent_schedule")
      .select(`
        id, org_id, tenancy_id, due_date, rent_amount, amount_outstanding, payment_reference, warning_sent_at,
        tenancy:tenancies(
          id,
          tenant:tenants(id, first_name, last_name, email),
          property:properties(id, address_line, postcode)
        )
      `)
      .in("status", ["overdue", "partial"])
      .lte("due_date", threeDaysAgo)
      .gt("amount_outstanding", 0);

    for (const item of overdueItems || []) {
      if (item.warning_sent_at && item.warning_sent_at > sevenDaysAgoStr) continue;

      const tenant = (item as any).tenancy?.tenant;
      const property = (item as any).tenancy?.property;
      if (!tenant?.email) continue;

      const tenantName = `${tenant.first_name} ${tenant.last_name}`;
      const address = `${property.address_line}${property.postcode ? `, ${property.postcode}` : ""}`;
      const dueDate = new Date(item.due_date);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      try {
        await resend.emails.send({
          from: "Tenure IQ <onboarding@resend.dev>",
          to: [tenant.email],
          subject: `URGENT: Overdue Rent Payment — ${address}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <p>Dear ${tenantName},</p>
            <p>Your rent payment of <strong>£${item.amount_outstanding}</strong> is now <strong>${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}</strong> overdue.</p>
            <p>Please contact us immediately to arrange payment or discuss a payment plan.</p>
            <p><strong>Outstanding Amount:</strong> £${item.amount_outstanding}<br>
            <strong>Original Due Date:</strong> ${item.due_date}</p>
            <p>Thank you</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
            <p style="color:#888;font-size:12px">Sent automatically by Tenure IQ.</p>
          </div>`,
        });

        await supabase.from("payment_reminders").insert({
          org_id: item.org_id,
          rent_schedule_id: item.id,
          tenancy_id: item.tenancy_id,
          reminder_type: "overdue",
          recipient_email: tenant.email,
          recipient_name: tenantName,
          status: "sent",
        });

        await supabase.from("rent_schedule").update({ warning_sent_at: now.toISOString() }).eq("id", item.id);
        sent++;
      } catch (e) {
        console.error("Overdue email failed:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, message: `Sent ${sent} reminders` }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Cron authorization required" ? 403 : 500;
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
}));
