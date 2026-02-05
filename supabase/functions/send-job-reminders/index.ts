 import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
 import { Resend } from 'https://esm.sh/resend@4.0.0';
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
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
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const results: ReminderResult[] = [];
 
     // 1. Find jobs requested but no response in 3+ days
     const threeDaysAgo = new Date();
     threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
 
     console.log('Finding pending jobs older than:', threeDaysAgo.toISOString());
 
     const { data: pendingJobs, error: pendingError } = await supabase
       .from('contractor_jobs')
       .select(`
         *,
         contractor:contractors(name, email),
         property:properties(address_line)
       `)
       .eq('status', 'requested')
       .lt('requested_at', threeDaysAgo.toISOString());
 
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
             from: 'HydrogenCap <noreply@hydrogencapital.lovable.app>',
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
 
     const { data: tomorrowJobs, error: tomorrowError } = await supabase
       .from('contractor_jobs')
       .select(`
         *,
         contractor:contractors(name, phone, email),
         property:properties(address_line),
         created_by
       `)
       .eq('status', 'booked')
       .eq('booked_date', tomorrowStr);
 
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
               from: 'HydrogenCap <noreply@hydrogencapital.lovable.app>',
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
     console.error('Error in send-job-reminders:', error);
     return new Response(JSON.stringify({ error: error.message }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
   }
 });