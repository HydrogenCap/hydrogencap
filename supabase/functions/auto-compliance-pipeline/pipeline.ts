/**
 * Testable core of the auto-compliance-pipeline edge function.
 *
 * No top-level esm.sh imports — all I/O goes through an injected supabase
 * client shape. index.ts owns the Deno runtime wiring, this file owns the
 * logic.
 */

// ─── Structural Supabase client ─────────────────────────────────────

// deno-lint-ignore no-explicit-any
export type SupabaseLike = {
  // deno-lint-ignore no-explicit-any
  from: (table: string) => any;
  auth: {
    getUser: (token: string) => Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
};

// ─── Types ──────────────────────────────────────────────────────────

export interface RequestAuthorization {
  mode: "cron" | "user";
  manageableOrgIds: string[] | null;
}

export interface PipelineResult {
  tasks_created: number;
  contractors_assigned: number;
  notifications_sent: number;
  requests_sent: number;
  priorities_updated: number;
}

// ─── Pure helpers ───────────────────────────────────────────────────

export function daysBetween(a: string, b: string): number {
  const msPerDay = 86400000;
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

export function getPriority(daysUntil: number): string {
  if (daysUntil <= 7) return "critical";
  if (daysUntil <= 30) return "high";
  if (daysUntil <= 60) return "medium";
  return "low";
}

export function buildCorsHeaders(req: Request, allowedOrigins: string[]): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

// ─── Authorisation ──────────────────────────────────────────────────

export async function authorizeRequest(
  req: Request,
  supabase: SupabaseLike,
  cronSecret?: string,
): Promise<RequestAuthorization> {
  const authHeader = req.headers.get("Authorization");

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { mode: "cron", manageableOrgIds: null };
  }

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"]);

  if (membershipError) throw membershipError;

  const rawMemberships = (memberships || []) as Array<{ org_id: string; role: string }>;
  const manageableOrgIds = [...new Set(rawMemberships.map((m) => m.org_id))];
  if (manageableOrgIds.length === 0) {
    throw new Error("Access denied");
  }

  return { mode: "user", manageableOrgIds };
}

// ─── Main pipeline ──────────────────────────────────────────────────

interface ComplianceTemplate {
  document_type: string;
  display_name: string;
  default_lead_time_days: number | null;
  default_frequency_months?: number | null;
}

interface ExpiringDoc {
  id: string;
  property_id: string;
  document_type: string;
  expiry_date: string | null;
  org_id: string;
  property: { address_line_1: string; city?: string | null; postcode?: string | null } | null;
}

interface OpenTask {
  id: string;
  due_date: string | null;
  priority: string;
}

export async function runAutoCompliancePipeline(
  supabase: SupabaseLike,
  authorization: RequestAuthorization,
  now: Date = new Date(),
): Promise<PipelineResult> {
  // Templates drive the renewal window per document type.
  const { data: templates, error: tplErr } = await supabase
    .from("compliance_templates")
    .select("document_type, display_name, default_lead_time_days, default_frequency_months")
    .eq("is_active", true);

  if (tplErr) throw tplErr;

  const tplList = (templates || []) as ComplianceTemplate[];
  const maxLeadDays = Math.max(...tplList.map((t) => t.default_lead_time_days || 90), 90);
  const today = now.toISOString().slice(0, 10);
  const futureDate = new Date(now.getTime() + maxLeadDays * 86400000).toISOString().slice(0, 10);

  // Documents expiring within the window.
  let docsQuery = supabase
    .from("compliance_documents_v2")
    .select(
      "id, property_id, document_type, expiry_date, org_id, property:properties_v2!compliance_documents_v2_property_id_fkey(address_line_1, city, postcode)",
    )
    .eq("is_current", true)
    .not("expiry_date", "is", null)
    .lte("expiry_date", futureDate)
    .order("expiry_date", { ascending: true });

  if (authorization.mode === "user" && authorization.manageableOrgIds) {
    docsQuery = docsQuery.in("org_id", authorization.manageableOrgIds);
  }

  const { data: expiringDocs, error: docErr } = await docsQuery;
  if (docErr) throw docErr;

  const result: PipelineResult = {
    tasks_created: 0,
    contractors_assigned: 0,
    notifications_sent: 0,
    requests_sent: 0,
    priorities_updated: 0,
  };

  const docs = (expiringDocs || []) as ExpiringDoc[];

  for (const doc of docs) {
    if (!doc.expiry_date) continue;
    const template = tplList.find((t) => t.document_type === doc.document_type);
    const leadTime = template?.default_lead_time_days || 30;
    const daysUntil = daysBetween(today, doc.expiry_date);

    // Skip if not yet in the renewal window (unless already expired).
    if (daysUntil > leadTime) continue;

    // Avoid duplicating an already-open task for this property/doc-type.
    const { data: existingTask } = await supabase
      .from("compliance_tasks")
      .select("id")
      .eq("property_id", doc.property_id)
      .eq("document_type", doc.document_type)
      .in("status", ["open", "in_progress", "waiting", "pending", "contractor_assigned", "contractor_requested", "awaiting_upload"])
      .maybeSingle();

    if (existingTask) continue;

    // Preferred contractor for this doc type + org (nullable).
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
      ? `${doc.property.address_line_1}${doc.property.city ? ", " + doc.property.city : ""}${doc.property.postcode ? " " + doc.property.postcode : ""}`
      : "Unknown property";

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
      })
      .select("id")
      .single();

    if (taskErr) {
      // 23505 = unique_violation — concurrent run beat us to it, skip quietly.
      if ((taskErr as { code?: string }).code === "23505") {
        console.log(`Task for ${doc.property_id}/${doc.document_type} already created by concurrent run`);
      } else {
        console.error("Error creating task:", taskErr);
      }
      continue;
    }

    result.tasks_created++;
    if (contractor) result.contractors_assigned++;

    await supabase.from("compliance_notifications").insert({
      org_id: doc.org_id,
      property_id: doc.property_id,
      notification_type: daysUntil <= 0 ? "expired" : "expiring_soon",
      document_type: doc.document_type,
      compliance_task_id: task.id,
      message: `${displayName} for ${propertyAddr} ${daysUntil <= 0 ? "has expired" : `expires in ${daysUntil} days`}`,
      status: "pending",
      channel: "in_app",
    });
    result.notifications_sent++;

    if (["critical", "high"].includes(priority) && contractor?.email) {
      try {
        await supabase
          .from("compliance_tasks")
          .update({ status: "contractor_requested" })
          .eq("id", task.id);
        result.requests_sent++;
      } catch (e) {
        console.error("Error sending contractor request:", e);
      }
    }
  }

  // Recompute priorities on existing open tasks.
  let openTasksQuery = supabase
    .from("compliance_tasks")
    .select("id, due_date, priority")
    .in("status", ["open", "in_progress", "waiting", "pending", "contractor_assigned", "contractor_requested", "awaiting_upload"])
    .not("due_date", "is", null);

  if (authorization.mode === "user" && authorization.manageableOrgIds) {
    openTasksQuery = openTasksQuery.in("org_id", authorization.manageableOrgIds);
  }

  const { data: openTasks } = await openTasksQuery;
  const tasks = (openTasks || []) as OpenTask[];

  for (const task of tasks) {
    if (!task.due_date) continue;
    const daysUntil = daysBetween(today, task.due_date);
    const newPriority = getPriority(daysUntil);
    if (newPriority !== task.priority) {
      await supabase
        .from("compliance_tasks")
        .update({ priority: newPriority })
        .eq("id", task.id);
      result.priorities_updated++;
    }
  }

  return result;
}
