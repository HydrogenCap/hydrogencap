 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
 import { Resend } from "https://esm.sh/resend@4.0.0";
 
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
 
interface ComplianceItem {
  id: string;
  property_id: string;
  compliance_type: string;
  expiry_date: string;
  org_id: string;
  last_reminder_sent_at: string | null;
  reminder_count: number | null;
  property?: {
     address_line: string;
     postcode: string;
  }[] | { address_line: string; postcode: string; } | null;
 }

interface RequestAuthorization {
  mode: "cron" | "user";
  manageableOrgIds: string[] | null;
}
 
 const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

async function authorizeRequest(req: Request): Promise<RequestAuthorization> {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { mode: "cron", manageableOrgIds: null };
  }

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
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

function getPropertyAddress(item: ComplianceItem): string {
  // Handle both array (from Supabase join) and object formats
  const prop = Array.isArray(item.property) ? item.property[0] : item.property;
  if (prop && prop.address_line) {
    const addr = prop.address_line;
    const postcode = prop.postcode;
    return postcode ? `${addr}, ${postcode}` : addr;
  }
  return 'Unknown Property';
}

 function generateComplianceReminderEmail(
   item: ComplianceItem,
   daysUntil: number,
   userName: string
 ): { subject: string; html: string } {
  const address = getPropertyAddress(item);
   const expiryDate = new Date(item.expiry_date).toLocaleDateString('en-GB', {
     weekday: 'long',
     year: 'numeric',
     month: 'long',
     day: 'numeric',
   });
 
   const urgencyColor = daysUntil <= 7 ? '#dc2626' : daysUntil <= 30 ? '#f59e0b' : '#10b981';
   const urgencyText = daysUntil <= 7 ? 'URGENT' : daysUntil <= 30 ? 'Action Required' : 'Reminder';
 
   const subject = `${urgencyText}: ${item.compliance_type} expires in ${daysUntil} days - ${address.split(',')[0]}`;
 
   const html = `
 <!DOCTYPE html>
 <html>
 <head>
   <meta charset="utf-8">
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
 </head>
 <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
   
   <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; border-radius: 12px 12px 0 0;">
     <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Compliance Reminder</h1>
   </div>
   
   <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
     <p style="margin-top: 0;">Hi ${userName},</p>
     
     <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid ${urgencyColor};">
       <p style="margin: 0 0 10px 0; font-weight: 600; color: ${urgencyColor};">${urgencyText}</p>
       <h2 style="margin: 0 0 10px 0; font-size: 18px;">${item.compliance_type}</h2>
       <p style="margin: 0; color: #6b7280;">
         <strong>${address}</strong><br>
         Expires: ${expiryDate} (${daysUntil} days)
       </p>
     </div>
     
     <p>Please arrange renewal of this certificate before it expires to remain compliant.</p>
     
     <a href="https://tenureiq.com/properties/${item.property_id}?tab=compliance" 
        style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 10px 0;">
       View Property Compliance
     </a>
     
     <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
       You can manage your notification preferences in 
       <a href="https://tenureiq.com/settings?tab=notifications" style="color: #2563eb;">Settings</a>.
     </p>
   </div>
   
   <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
     <p>Tenure IQ Property Portfolio Management</p>
   </div>
 </body>
 </html>
   `;
 
   return { subject, html };
 }
 
 serve(async (req) => {
   // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: getCorsHeaders(req) });
    }

    let authorization: RequestAuthorization;
    try {
      authorization = await authorizeRequest(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unauthorized";
      const status = message === "Access denied" ? 403 : 401;
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
 
   try {
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     console.log("Starting compliance reminder processing...");
 
    // Direct approach: find compliance items expiring within reminder windows
    const today = new Date();
    const reminderWindows = [90, 60, 30, 14, 7, 3, 1]; // days before expiry
    
    // Get all compliance items expiring in the next 90 days
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 90);
    
    let itemsQuery = supabase
      .from('compliance_items')
      .select(`
        id, property_id, compliance_type, expiry_date, org_id, 
        last_reminder_sent_at, reminder_count,
        property:properties(address_line, postcode)
      `)
      .gte('expiry_date', today.toISOString().split('T')[0])
      .lte('expiry_date', futureDate.toISOString().split('T')[0]);

    if (authorization.mode === "user" && authorization.manageableOrgIds) {
      itemsQuery = itemsQuery.in("org_id", authorization.manageableOrgIds);
    }

    const { data: expiringItems, error: itemsError } = await itemsQuery;

    if (itemsError) throw itemsError;

    console.log(`Found ${expiringItems?.length || 0} items expiring in next 90 days`);

    const results: { item: string; status: string; error?: string }[] = [];
    const processedOrgs = new Set<string>();

    for (const item of expiringItems || []) {
      const expiryDate = new Date(item.expiry_date);
      const daysUntil = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // Check if we should send for this reminder window
      const shouldSend = reminderWindows.some(window => {
        // Send if days until expiry matches a window (with 1 day tolerance)
        return Math.abs(daysUntil - window) <= 1;
      });

      // Skip if not in a reminder window or already sent today
      if (!shouldSend) continue;
      
      const lastSent = item.last_reminder_sent_at ? new Date(item.last_reminder_sent_at) : null;
      const sentToday = lastSent && (today.getTime() - lastSent.getTime()) < (24 * 60 * 60 * 1000);
      if (sentToday) {
        console.log(`Skipping ${item.compliance_type} - already sent today`);
        continue;
      }

      // Get users in this org who have notifications enabled
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('user_id, reminder_days')
        .eq('org_id', item.org_id)
        .eq('email_enabled', true)
        .eq('notify_expiring_soon', true);

      if (!prefs?.length) {
        console.log(`No users with notifications enabled for org ${item.org_id}`);
        continue;
      }

      for (const pref of prefs) {
        // Check if this user wants reminders at this interval
        const userWantsReminder = pref.reminder_days?.some((d: number) => Math.abs(daysUntil - d) <= 1);
        if (!userWantsReminder) continue;

        // Get user email
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('user_id', pref.user_id)
          .single();

        if (!profile?.email) continue;

        try {
          const { subject, html } = generateComplianceReminderEmail(
            item, 
            daysUntil, 
            profile.full_name || 'there'
          );

          const emailResult = await resend.emails.send({
            from: "Tenure IQ <onboarding@resend.dev>",
            to: [profile.email],
            subject,
            html,
          });

          console.log(`Email sent to ${profile.email}: ${subject}`, JSON.stringify(emailResult));

          if (emailResult.error) {
            throw new Error(emailResult.error.message);
          }

          // Log the notification
          await supabase.from('notification_log').insert({
            org_id: item.org_id,
            user_id: pref.user_id,
            notification_type: 'compliance_reminder',
            reference_type: 'compliance_item',
            reference_id: item.id,
            channel: 'email',
            recipient: profile.email,
            subject,
            status: 'sent',
            sent_at: new Date().toISOString(),
          });

          results.push({ item: `${item.compliance_type} (${daysUntil}d)`, status: 'sent' });
        } catch (emailErr: any) {
          console.error(`Failed to send email:`, emailErr);
          results.push({ item: `${item.compliance_type}`, status: 'failed', error: emailErr.message });
        }
      }

      // Update reminder tracking on the compliance item
      await supabase
        .from('compliance_items')
        .update({
          last_reminder_sent_at: new Date().toISOString(),
          reminder_count: (item.reminder_count || 0) + 1,
        })
        .eq('id', item.id);
     }
 
     return new Response(JSON.stringify({ 
       processed: results.length, 
       results,
       timestamp: new Date().toISOString(),
     }), {
       headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
     });
 
   } catch (error: any) {
     const message = error instanceof Error ? error.message : "Unknown error";
     const status = message === "Unauthorized" ? 401 : message === "Access denied" ? 403 : 500;
     console.error('Error:', error);
     return new Response(JSON.stringify({ error: message }), {
       status,
       headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
     });
   }
 });
