import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@hydrogencap.co.uk";

const ALLOWED_ORIGINS = [
  "https://hydrogencap.com",
  "https://www.hydrogencap.com",
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // Verify cron/admin authorization
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("Authorization");

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      // Authorized as cron job
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

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const resend = new Resend(RESEND_API_KEY);

    // Find active tenancies expiring within 60 days
    const now = new Date();
    const sixtyDays = new Date(now.getTime() + 60 * 86400000).toISOString().split("T")[0];

    const { data: tenancies, error } = await supabase
      .from("tenancies")
      .select(`
        id, end_date, rent_amount_pcm, status,
        tenant:tenants(id, first_name, last_name, email),
        room:rooms(room_name),
        property:properties(id, address_line, postcode)
      `)
      .in("status", ["active", "notice"])
      .not("end_date", "is", null)
      .lte("end_date", sixtyDays)
      .order("end_date", { ascending: true });

    if (error) throw error;
    if (!tenancies || tenancies.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No expiring tenancies" }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Get org users who should receive alerts
    const { data: orgUsers, error: usersError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .not("email", "is", null);

    if (usersError) throw usersError;

    let sentCount = 0;

    // Send one summary email to each admin
    for (const user of orgUsers || []) {
      if (!user.email) continue;

      const rows = tenancies.map((t: any) => {
        const endDate = new Date(t.end_date!);
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / 86400000);
        const tenant = t.tenant;
        const room = t.room;
        const property = t.property;

        return `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee">${tenant?.first_name} ${tenant?.last_name}</td>
            <td style="padding:8px;border-bottom:1px solid #eee">${room?.room_name || '—'}</td>
            <td style="padding:8px;border-bottom:1px solid #eee">${property?.address_line || '—'}</td>
            <td style="padding:8px;border-bottom:1px solid #eee">${endDate.toLocaleDateString('en-GB')}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;color:${daysLeft <= 0 ? '#dc2626' : daysLeft <= 30 ? '#d97706' : '#6b7280'};font-weight:bold">
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
          <p style="margin-top:24px;color:#94a3b8;font-size:12px">— HydrogenCap</p>
        </div>
      `;

      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: user.email,
          subject: `⚠️ ${tenancies.length} Tenancies Expiring Soon`,
          html,
        });
        sentCount++;
      } catch (emailErr) {
        console.error(`Failed to send to ${user.email}:`, emailErr);
      }
    }

    return new Response(
      JSON.stringify({ sent: sentCount, tenancies: tenancies.length }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
