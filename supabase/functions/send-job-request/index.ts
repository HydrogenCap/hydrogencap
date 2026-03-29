 import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
 import { Resend } from 'https://esm.sh/resend@4.0.0';
 import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts';
 
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
 
 interface JobRequestParams {
   jobId: string;
   customMessage?: string;
 }
 
 function generateJobRequestEmail(params: {
   contractorName: string;
   complianceType: string;
   propertyAddress: string;
   expiryDate: string | null;
   customMessage: string;
   senderName: string;
   senderEmail: string;
   senderPhone?: string;
   jobReference: string;
 }): { subject: string; html: string } {
   const {
     contractorName,
     complianceType,
     propertyAddress,
     expiryDate,
     customMessage,
     senderName,
     senderEmail,
     senderPhone,
     jobReference,
   } = params;
 
   const subject = `Job Request: ${complianceType} - ${propertyAddress.split(',')[0]}`;
 
   const html = `
 <!DOCTYPE html>
 <html>
 <head>
   <meta charset="utf-8">
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
 </head>
 <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
   
   <div style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); padding: 30px; border-radius: 12px 12px 0 0;">
     <h1 style="color: white; margin: 0; font-size: 24px;">Job Request</h1>
     <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Reference: ${jobReference}</p>
   </div>
   
   <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
     <p style="margin-top: 0;">Hi ${contractorName},</p>
     
     <p>I would like to request a quote for the following work:</p>
     
     <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
       <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #14b8a6;">${complianceType}</h2>
       
       <table style="width: 100%; border-collapse: collapse;">
         <tr>
           <td style="padding: 8px 0; color: #6b7280; width: 120px;">Property:</td>
           <td style="padding: 8px 0; font-weight: 500;">${propertyAddress}</td>
         </tr>
         ${expiryDate ? `
         <tr>
           <td style="padding: 8px 0; color: #6b7280;">Current Expiry:</td>
           <td style="padding: 8px 0; font-weight: 500;">${new Date(expiryDate).toLocaleDateString('en-GB', { 
             weekday: 'long', 
             year: 'numeric', 
             month: 'long', 
             day: 'numeric' 
           })}</td>
         </tr>
         ` : ''}
       </table>
     </div>
     
     ${customMessage ? `
     <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b;">
       <p style="margin: 0; white-space: pre-wrap;">${customMessage}</p>
     </div>
     ` : ''}
     
     <p>Please reply to this email with:</p>
     <ul style="margin: 10px 0; padding-left: 20px;">
       <li>Your quote for this work</li>
       <li>Your earliest available dates</li>
       <li>Any questions about the property or requirements</li>
     </ul>
     
     <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0; border: 1px solid #e5e7eb;">
       <p style="margin: 0 0 5px 0; font-weight: 600;">Contact Details</p>
       <p style="margin: 0; color: #6b7280;">
         ${senderName}<br>
         ${senderEmail}
         ${senderPhone ? `<br>${senderPhone}` : ''}
       </p>
     </div>
     
     <p style="margin-bottom: 0;">Kind regards,<br>${senderName}</p>
   </div>
   
   <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
     <p>Sent via Tenure IQ Property Management</p>
   </div>
 </body>
 </html>
   `;
 
   return { subject, html };
 }
 
 serve(async (req) => {
   const corsHeaders = getCorsHeaders(req);
   // Handle CORS preflight requests
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
  try {
     // Authenticate the caller
     const authHeader = req.headers.get('Authorization');
     if (!authHeader?.startsWith('Bearer ')) {
       return new Response(JSON.stringify({ error: 'Unauthorized' }), {
         status: 401,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }

     const token = authHeader.replace('Bearer ', '');
     const { data: { user }, error: authError } = await supabase.auth.getUser(token);
     if (authError || !user) {
       return new Response(JSON.stringify({ error: 'Unauthorized' }), {
         status: 401,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }

     const rateLimit = await checkRateLimit(user.id, 'send-job-request', 30, 60);
     if (!rateLimit.allowed) return rateLimitResponse(corsHeaders, rateLimit.remaining, rateLimit.resetAt);

     const { jobId, customMessage }: JobRequestParams = await req.json();
 
     if (!jobId) {
       return new Response(JSON.stringify({ error: 'jobId required' }), { 
         status: 400,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }

     console.log('Processing job request:', jobId);
 
    // Get job details with related data
    const { data: job, error: jobError } = await supabase
      .from('contractor_jobs')
      .select(`
        *,
        contractor:contractors(*),
        property:properties(address_line, postcode),
        compliance_item:compliance_items!contractor_jobs_compliance_item_id_fkey(compliance_type, expiry_date)
      `)
      .eq('id', jobId)
      .single();
 
     if (jobError || !job) {
       console.error('Job not found:', jobError);
       return new Response(JSON.stringify({ error: 'Job not found' }), { 
         status: 404,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }

     const { data: membership } = await supabase
       .from('memberships')
       .select('org_id, role')
       .eq('user_id', user.id)
       .eq('org_id', job.org_id)
       .maybeSingle();

     if (!membership) {
       return new Response(JSON.stringify({ error: 'Access denied' }), {
         status: 403,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }

     if (membership.role === 'viewer') {
       return new Response(JSON.stringify({ error: 'Viewers cannot send job requests' }), {
         status: 403,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     if (!job.contractor?.email) {
       return new Response(JSON.stringify({ error: 'Contractor has no email address' }), { 
         status: 400,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     // Get sender (user who created the job)
     const { data: senderProfile } = await supabase
       .from('profiles')
       .select('full_name')
       .eq('user_id', job.created_by)
       .single();
 
     const { data: senderAuth } = await supabase.auth.admin.getUserById(job.created_by);
 
     // Generate job reference
     const jobRef = `JOB-${job.id.slice(0, 8).toUpperCase()}`;
 
     // Generate email content
     const { subject, html } = generateJobRequestEmail({
       contractorName: job.contractor.name,
       complianceType: job.job_type,
       propertyAddress: `${job.property.address_line}, ${job.property.postcode}`,
       expiryDate: job.compliance_item?.expiry_date || null,
       customMessage: customMessage || job.request_message || '',
       senderName: senderProfile?.full_name || 'Property Manager',
       senderEmail: senderAuth?.user?.email || '',
       senderPhone: undefined,
       jobReference: jobRef,
     });
 
     console.log('Sending email to:', job.contractor.email);
 
     // Send email via Resend
     const emailResponse = await resend.emails.send({
       from: 'Tenure IQ <noreply@hydrogencapital.lovable.app>',
       to: [job.contractor.email],
       subject,
       html,
      replyTo: senderAuth?.user?.email,
     });
 
     console.log('Email sent:', emailResponse);
 
     // Update job status
     await supabase
       .from('contractor_jobs')
       .update({
         status: 'requested',
         requested_at: new Date().toISOString(),
         request_message: customMessage || job.request_message,
         updated_at: new Date().toISOString(),
       })
       .eq('id', jobId);
 
     // Log notification
     await supabase.from('notification_log').insert({
       org_id: job.org_id,
       user_id: job.created_by,
       notification_type: 'job_request',
       reference_type: 'contractor_job',
       reference_id: jobId,
       channel: 'email',
       recipient: job.contractor.email,
       subject,
       status: 'sent',
       sent_at: new Date().toISOString(),
     });
 
     return new Response(JSON.stringify({
       success: true,
       jobReference: jobRef,
       sentTo: job.contractor.email,
     }), {
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
 
  } catch (error: any) {
     console.error('Error sending job request:', error);
     return new Response(JSON.stringify({ error: error.message }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
   }
 });
