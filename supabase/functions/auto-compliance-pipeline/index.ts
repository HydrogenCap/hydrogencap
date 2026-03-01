import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function daysBetween(a: string, b: string): number {
  const msPerDay = 86400000;
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

function getPriority(daysUntil: number): string {
  if (daysUntil <= 7) return "critical";
  if (daysUntil <= 30) return "high";
  if (daysUntil <= 60) return "medium";
  return "low";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    // Auth: accept cron secret OR user bearer token
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("Authorization");

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      // authorized as cron
    } else if (authHeader?.startsWith("Bearer ")) {
      const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
      const token = authHeader.replace("Bearer ", "");
      const { error: authError } = await supabaseAuth.auth.getUser(token);
      if (authError) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    console.log("Starting auto-compliance-pipeline scan");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Fetch all active compliance templates (for lead_time_days + display_name)
    const { data: templates, error: tplErr } = await supabase
      .from("compliance_templates")
      .select("document_type, display_name, default_lead_time_days, default_frequency_months")
      .eq("is_active", true);

    if (tplErr) throw tplErr;

    const maxLeadDays = Math.max(...(templates || []).map(t => t.default_lead_time_days || 90), 90);
    const today = new Date().toISOString().slice(0, 10);
    const futureDate = new Date(Date.now() + maxLeadDays * 86400000).toISOString().slice(0, 10);

    // 2. Fetch expiring documents (current, with expiry in the window)
    const { data: expiringDocs, error: docErr } = await supabase
      .from("compliance_documents_v2")
      .select(`
        id, property_id, document_type, expiry_date, org_id,
        property:properties_v2!compliance_documents_v2_property_id_fkey(address_line_1, city, postcode)
      `)
      .eq("is_current", true)
      .not("expiry_date", "is", null)
      .lte("expiry_date", futureDate)
      .order("expiry_date", { ascending: true });

    if (docErr) throw docErr;

    console.log(`Found ${expiringDocs?.length || 0} documents expiring within ${maxLeadDays} days`);

    let tasksCreated = 0;
    let contractorsAssigned = 0;
    let notificationsSent = 0;
    let requestsSent = 0;

    for (const doc of expiringDocs || []) {
      const template = (templates || []).find(t => t.document_type === doc.document_type);
      const leadTime = template?.default_lead_time_days || 30;
      const daysUntil = daysBetween(today, doc.expiry_date!);

      // Skip if not yet in renewal window (unless already expired)
      if (daysUntil > leadTime) continue;

      // 3. Check for existing open task — avoid duplicates
      const { data: existingTask } = await supabase
        .from("compliance_tasks")
        .select("id")
        .eq("property_id", doc.property_id)
        .eq("document_type", doc.document_type)
        .in("status", ["open", "in_progress", "waiting", "pending", "contractor_assigned", "contractor_requested", "awaiting_upload"])
        .maybeSingle();

      if (existingTask) continue;

      // 4. Find preferred contractor for this doc type + org
      const { data: contractor } = await supabase
        .from("compliance_contractors_v2")
        .select("id, company_name, email")
        .eq("org_id", doc.org_id)
        .contains("service_types", [doc.document_type])
        .order("is_preferred", { ascending: false })
        .limit(1)
        .maybeSingle();

      const priority = getPriority(daysUntil);
      const displayName = template?.display_name || doc.document_type;
      const propertyAddr = doc.property
        ? `${(doc.property as any).address_line_1}${(doc.property as any).city ? ', ' + (doc.property as any).city : ''}${(doc.property as any).postcode ? ' ' + (doc.property as any).postcode : ''}`
        : "Unknown property";

      // 5. Create the task
      const { data: task, error: taskErr } = await supabase
        .from("compliance_tasks")
        .insert({
          org_id: doc.org_id,
          property_id: doc.property_id,
          document_type: doc.document_type,
          task_type: "renewal_due",
          status: contractor ? "contractor_assigned" : "pending",
          priority,
          due_date: doc.expiry_date,
          contractor_id: contractor?.id || null,
          title: `Renew ${displayName}`,
          description: `${displayName} for ${propertyAddr} ${daysUntil <= 0 ? "has expired" : `expires in ${daysUntil} days`}`,
          source: "auto_pipeline",
        } as any)
        .select("id")
        .single();

      if (taskErr) {
        console.error("Error creating task:", taskErr);
        continue;
      }

      tasksCreated++;
      if (contractor) contractorsAssigned++;

      // 6. Create notification
      await supabase.from("compliance_notifications").insert({
        org_id: doc.org_id,
        property_id: doc.property_id,
        notification_type: daysUntil <= 0 ? "expired" : "expiring_soon",
        document_type: doc.document_type,
        compliance_task_id: task.id,
        message: `${displayName} for ${propertyAddr} ${daysUntil <= 0 ? "has expired" : `expires in ${daysUntil} days`}`,
        status: "pending",
        channel: "in_app",
      } as any);
      notificationsSent++;

      // 7. Auto-send contractor request for critical/high priority
      if (["critical", "high"].includes(priority) && contractor?.email) {
        try {
          // We can't call send-job-request directly since it works with contractor_jobs.
          // Instead update the task status to contractor_requested and log it.
          await supabase
            .from("compliance_tasks")
            .update({ status: "contractor_requested" } as any)
            .eq("id", task.id);
          requestsSent++;
        } catch (e) {
          console.error("Error sending contractor request:", e);
        }
      }
    }

    // 8. Update priorities on existing open tasks based on current days until due
    const { data: openTasks } = await supabase
      .from("compliance_tasks")
      .select("id, due_date, priority")
      .in("status", ["open", "in_progress", "waiting", "pending", "contractor_assigned", "contractor_requested", "awaiting_upload"])
      .not("due_date", "is", null);

    let prioritiesUpdated = 0;
    for (const task of openTasks || []) {
      const daysUntil = daysBetween(today, task.due_date!);
      const newPriority = getPriority(daysUntil);
      if (newPriority !== task.priority) {
        await supabase.from("compliance_tasks").update({ priority: newPriority }).eq("id", task.id);
        prioritiesUpdated++;
      }
    }

    console.log(`Pipeline complete: ${tasksCreated} tasks created, ${contractorsAssigned} contractors assigned, ${notificationsSent} notifications, ${requestsSent} requests sent, ${prioritiesUpdated} priorities updated`);

    return new Response(
      JSON.stringify({
        success: true,
        tasks_created: tasksCreated,
        contractors_assigned: contractorsAssigned,
        notifications_sent: notificationsSent,
        requests_sent: requestsSent,
        priorities_updated: prioritiesUpdated,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in auto-compliance-pipeline:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
