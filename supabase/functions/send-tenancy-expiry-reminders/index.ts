import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@4.0.0";

import { withInvocationLog } from "../_shared/logger.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@hydrogencap.co.uk";

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

interface RequestAuthorization {
  mode: "cron" | "user";
  manageableOrgIds: string[] | null;
}

interface MembershipRow {
  org_id: string;
  role: string;
  user_id: string;
}

interface ProfileRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
}

async function authorizeRequest(req: Request): Promise<RequestAuthorization> {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { mode: "cron", manageableOrgIds: null };
  }

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(token);

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: memberships, error: membershipError } = await supabaseAuth
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"]);

  if (membershipError) {
    throw membershipError;
  }

  const manageableOrgIds = [...new Set((memberships || []).map((membership) => membership.org_id))];
  if (manageableOrgIds.length === 0) {
    throw new Error("Access denied");
  }

  return { mode: "user", manageableOrgIds };
}

serve(withInvocationLog("send-tenancy-expiry-reminders", async (req, _invocationLog) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authorization = await authorizeRequest(req);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const resend = new Resend(RESEND_API_KEY);

    const now = new Date();
    const sixtyDays = new Date(now.getTime() + 60 * 86400000).toISOString().split("T")[0];

    let tenanciesQuery = supabase
      .from("tenancies")
      .select(`
        id, org_id, end_date, rent_amount_pcm, status,
        tenant:tenants(id, first_name, last_name, email),
        room:rooms(room_name),
        property:properties(id, address_line, postcode)
      `)
      .in("status", ["active", "notice"])
      .not("end_date", "is", null)
      .lte("end_date", sixtyDays)
      .order("end_date", { ascending: true });

    if (authorization.mode === "user" && authorization.manageableOrgIds) {
      tenanciesQuery = tenanciesQuery.in("org_id", authorization.manageableOrgIds);
    }

    const { data: tenancies, error } = await tenanciesQuery;
    if (error) throw error;

    if (!tenancies || tenancies.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No expiring tenancies" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenancyOrgIds = [...new Set(tenancies.map((tenancy) => tenancy.org_id).filter(Boolean))];
    const { data: memberships, error: membershipsError } = await supabase
      .from("memberships")
      .select("org_id, role, user_id")
      .in("org_id", tenancyOrgIds)
      .in("role", ["owner", "admin"]);

    if (membershipsError) throw membershipsError;

    const adminMemberships = (memberships || []) as MembershipRow[];
    const uniqueUserIds = [...new Set(adminMemberships.map((membership) => membership.user_id))];

    if (uniqueUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, tenancies: tenancies.length, message: "No org admins found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .in("user_id", uniqueUserIds)
      .not("email", "is", null);

    if (profilesError) throw profilesError;

    const profilesByUserId = new Map(
      ((profiles || []) as ProfileRow[]).map((profile) => [profile.user_id, profile]),
    );
    const adminMembershipsByOrg = new Map<string, MembershipRow[]>();
    adminMemberships.forEach((membership) => {
      const existing = adminMembershipsByOrg.get(membership.org_id) || [];
      existing.push(membership);
      adminMembershipsByOrg.set(membership.org_id, existing);
    });
    const tenanciesByOrg = new Map<string, typeof tenancies>();
    tenancies.forEach((tenancy) => {
      const existing = tenanciesByOrg.get(tenancy.org_id) || [];
      existing.push(tenancy);
      tenanciesByOrg.set(tenancy.org_id, existing);
    });

    let sentCount = 0;

    for (const [orgId, orgTenancies] of tenanciesByOrg.entries()) {
      const recipients = (adminMembershipsByOrg.get(orgId) || [])
        .map((membership) => profilesByUserId.get(membership.user_id))
        .filter((profile): profile is ProfileRow => Boolean(profile?.email));

      if (recipients.length === 0) {
        continue;
      }

      const rows = orgTenancies.map((tenancy) => {
        const endDate = new Date(tenancy.end_date!);
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / 86400000);
        const tenant = Array.isArray(tenancy.tenant) ? tenancy.tenant[0] : tenancy.tenant;
        const room = Array.isArray(tenancy.room) ? tenancy.room[0] : tenancy.room;
        const property = Array.isArray(tenancy.property) ? tenancy.property[0] : tenancy.property;

        return `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee">${tenant?.first_name || ""} ${tenant?.last_name || ""}</td>
            <td style="padding:8px;border-bottom:1px solid #eee">${room?.room_name || "-"}</td>
            <td style="padding:8px;border-bottom:1px solid #eee">${property?.address_line || "-"}</td>
            <td style="padding:8px;border-bottom:1px solid #eee">${endDate.toLocaleDateString("en-GB")}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;color:${daysLeft <= 0 ? "#dc2626" : daysLeft <= 30 ? "#d97706" : "#6b7280"};font-weight:bold">
              ${daysLeft <= 0 ? `Expired ${Math.abs(daysLeft)}d ago` : `${daysLeft} days`}
            </td>
          </tr>
        `;
      }).join("");

      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#0f172a">Tenancy Expiry Alert</h2>
          <p style="color:#64748b">The following tenancies are expiring within 60 days or have already expired:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0">Tenant</th>
                <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0">Room</th>
                <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0">Property</th>
                <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0">End Date</th>
                <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0">Time Left</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="color:#64748b;font-size:14px">
            Review these tenancies and decide whether to renew, renegotiate, or end each one.
          </p>
          <p style="margin-top:24px;color:#94a3b8;font-size:12px">- Tenure IQ</p>
        </div>
      `;

      for (const recipient of recipients) {
        try {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: recipient.email!,
            subject: `${orgTenancies.length} Tenancies Expiring Soon`,
            html,
          });
          sentCount++;
        } catch (emailErr) {
          console.error(`Failed to send to ${recipient.email}:`, emailErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ sent: sentCount, tenancies: tenancies.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" ? 401 : message === "Access denied" ? 403 : 500;
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
