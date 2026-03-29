 import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
 import { Resend } from 'https://esm.sh/resend@4.0.0';
 
 const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@tenureiq.com';
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
 
 const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
 const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
 const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 
 const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
 const resend = new Resend(RESEND_API_KEY);
 
interface ReminderResult {
  jobId: string;
  type: 'contractor_reminder' | 'owner_reminder';
  sent: boolean;
  error?: string;
}

interface RequestAuthorization {
  mode: 'cron' | 'user';
  manageableOrgIds: string[] | null;
}

async function authorizeRequest(req: Request): Promise<RequestAuthorization> {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { mode: 'cron', manageableOrgIds: null };
  }

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('memberships')
    .select('org_id, role')
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin']);

  if (membershipError) {
    throw membershipError;
  }

  const manageableOrgIds = [...new Set((memberships || []).map((membership) => membership.org_id))];
  if (manageableOrgIds.length === 0) {
    throw new Error('Access denied');
  }

  return { mode: 'user', manageableOrgIds };
}
 
 serve(async (req) => {
   const corsHeaders = getCorsHeaders(req);
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const authorization = await authorizeRequest(req);
     const results: ReminderResult[] = [];
 
     // 1. Find jobs requested but no response in 3+ days
     const threeDaysAgo = new Date();
     threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
 
     console.log('Finding pending jobs older than:', threeDaysAgo.toISOString());
 
     let pendingJobsQuery = supabase
       .from('contractor_jobs')
       .select(`
         *,
         contractor:contractors(name, email),
         property:properties(address_line)
       `)
       .eq('status', 'requested')
       .lt('requested_at', threeDaysAgo.toISOString());

     if (authorization.mode === 'user' && authorization.manageableOrgIds) {
       pendingJobsQuery = pendingJobsQuery.in('org_id', authorization.manageableOrgIds);
     }

     const { data: pendingJobs, error: pendingError } = await pendingJobsQuery;
 
     if (pendingError) {
       console.error('Error fetching pending jobs:', pendingError);
     }
 
     console.log(`Found ${pendingJobs?.length || 0} pending jobs needing reminders`);
 
     for (const job of pendingJobs || []) {
       if (job.contractor?.email) {
         try {
           const daysSinceRequest = Math.floor(
             (Date.now() - new Date(job.requested_at).getTime()) / (1000 * 60 * 60 * 24)
           );
 
           await resend.emails.send({
             from: `HydrogenCap <${FROM_EMAIL}>`,
             to: [job.contractor.email],
             subject: `Reminder: Quote requested - ${job.property.address_line.split(',')[0]}`,
             html: `
               <p>Hi ${job.contractor.name},</p>
               <p>This is a friendly reminder about a job request sent ${daysSinceRequest} days ago.</p>
               <p><strong>${job.job_type}</strong> at ${job.property.address_line}</p>
               <p>Please reply with your quote and availability, or let us know if you're unable to take this job.</p>
               <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">Sent via HydrogenCap Property Management</p>
             `,
           });
 
           results.push({ jobId: job.id, type: 'contractor_reminder', sent: true });
           console.log(`Sent reminder to contractor for job ${job.id}`);
         } catch (emailError: any) {
           console.error(`Failed to send reminder for job ${job.id}:`, emailError);
           results.push({ 
             jobId: job.id, 
             type: 'contractor_reminder', 
             sent: false, 
             error: emailError.message 
           });
         }
       }
     }
 
     // 2. Find booked jobs happening tomorrow - remind owner
     const tomorrow = new Date();
     tomorrow.setDate(tomorrow.getDate() + 1);
     const tomorrowStr = tomorrow.toISOString().split('T')[0];
 
     console.log('Finding jobs booked for:', tomorrowStr);
 
     let tomorrowJobsQuery = supabase
       .from('contractor_jobs')
       .select(`
         *,
         contractor:contractors(name, phone, email),
         property:properties(address_line),
         created_by
       `)
       .eq('status', 'booked')
       .eq('booked_date', tomorrowStr);

     if (authorization.mode === 'user' && authorization.manageableOrgIds) {
       tomorrowJobsQuery = tomorrowJobsQuery.in('org_id', authorization.manageableOrgIds);
     }

     const { data: tomorrowJobs, error: tomorrowError } = await tomorrowJobsQuery;
 
     if (tomorrowError) {
       console.error('Error fetching tomorrow jobs:', tomorrowError);
     }
 
     console.log(`Found ${tomorrowJobs?.length || 0} jobs booked for tomorrow`);
 
     for (const job of tomorrowJobs || []) {
       if (job.created_by) {
         try {
           // Get owner's email
           const { data: ownerAuth } = await supabase.auth.admin.getUserById(job.created_by);
           
           if (ownerAuth?.user?.email) {
             await resend.emails.send({
               from: `HydrogenCap <${FROM_EMAIL}>`,
               to: [ownerAuth.user.email],
               subject: `Reminder: ${job.job_type} scheduled tomorrow`,
               html: `
                 <p>Hi,</p>
                 <p>This is a reminder that you have work scheduled for tomorrow:</p>
                 <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                   <p style="margin: 0 0 8px 0;"><strong>${job.job_type}</strong></p>
                   <p style="margin: 0 0 4px 0;">${job.property.address_line}</p>
                   <p style="margin: 0 0 4px 0;">Contractor: ${job.contractor?.name || 'TBC'}</p>
                   ${job.contractor?.phone ? `<p style="margin: 0;">Phone: ${job.contractor.phone}</p>` : ''}
                   ${job.booked_time_slot ? `<p style="margin: 0;">Time: ${job.booked_time_slot}</p>` : ''}
                 </div>
                 <p>Please ensure access is arranged for the contractor.</p>
                 <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">Sent via HydrogenCap Property Management</p>
               `,
             });
 
             results.push({ jobId: job.id, type: 'owner_reminder', sent: true });
             console.log(`Sent owner reminder for job ${job.id}`);
           }
         } catch (emailError: any) {
           console.error(`Failed to send owner reminder for job ${job.id}:`, emailError);
           results.push({ 
             jobId: job.id, 
             type: 'owner_reminder', 
             sent: false, 
             error: emailError.message 
           });
         }
       }
     }
 
     return new Response(JSON.stringify({
       success: true,
       processed: results.length,
       results,
     }), {
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
 
   } catch (error: any) {
     const message = error instanceof Error ? error.message : 'Unknown error';
     const status = message === 'Unauthorized' ? 401 : message === 'Access denied' ? 403 : 500;
     console.error('Error in send-job-reminders:', error);
     return new Response(JSON.stringify({ error: message }), {
       status,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
   }
 });
