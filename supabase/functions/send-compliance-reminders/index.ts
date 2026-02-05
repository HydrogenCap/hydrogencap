 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
 import { Resend } from "https://esm.sh/resend@4.0.0";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 interface ScheduledNotification {
   id: string;
   org_id: string;
   user_id: string;
   notification_type: string;
   reference_type: string;
   reference_id: string;
   scheduled_for: string;
 }
 
 interface ComplianceItem {
   id: string;
   property_id: string;
   compliance_type: string;
   expiry_date: string;
   property?: {
     address_line: string;
     postcode: string;
   };
 }
 
 const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
 
 function generateComplianceReminderEmail(
   item: ComplianceItem,
   daysUntil: number,
   userName: string
 ): { subject: string; html: string } {
   const address = item.property?.address_line || 'Unknown Property';
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
     
     <a href="https://hydrogencap.lovable.app/properties/${item.property_id}?tab=compliance" 
        style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 10px 0;">
       View Property Compliance
     </a>
     
     <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
       You can manage your notification preferences in 
       <a href="https://hydrogencap.lovable.app/settings?tab=notifications" style="color: #2563eb;">Settings</a>.
     </p>
   </div>
   
   <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
     <p>HydrogenCap Property Portfolio Management</p>
   </div>
 </body>
 </html>
   `;
 
   return { subject, html };
 }
 
 serve(async (req) => {
   // Handle CORS preflight
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     console.log("Starting compliance reminder processing...");
 
     // Get pending notifications that are due
     const { data: pendingNotifications, error: fetchError } = await supabase
       .from('scheduled_notifications')
       .select('*')
       .eq('processed', false)
       .lte('scheduled_for', new Date().toISOString())
       .limit(100);
 
     if (fetchError) throw fetchError;
 
     console.log(`Processing ${pendingNotifications?.length || 0} notifications`);
 
     const results: { id: string; status: string; error?: string }[] = [];
 
     for (const notification of pendingNotifications || []) {
       try {
         // Get user email from profiles
         const { data: profile } = await supabase
           .from('profiles')
           .select('email, full_name')
           .eq('user_id', notification.user_id)
           .single();
         
         const userEmail = profile?.email;
         const userName = profile?.full_name || 'there';
 
         if (!userEmail) {
           console.log(`No email for user ${notification.user_id}`);
           continue;
         }
 
         if (notification.notification_type === 'compliance_reminder') {
           // Get compliance item details
           const { data: complianceItem } = await supabase
             .from('compliance_items')
             .select(`
               *,
               property:properties(address_line, postcode)
             `)
             .eq('id', notification.reference_id)
             .single();
 
           if (!complianceItem) {
             console.log(`Compliance item ${notification.reference_id} not found`);
             continue;
           }
 
           // Calculate days until expiry
           const expiryDate = new Date(complianceItem.expiry_date);
           const today = new Date();
           const daysUntil = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
 
           // Don't send if already expired
           if (daysUntil < 0) {
             console.log(`Skipping expired item ${complianceItem.id}`);
             continue;
           }
 
           // Generate and send email
           const { subject, html } = generateComplianceReminderEmail(complianceItem, daysUntil, userName);
           
           const emailResult = await resend.emails.send({
             from: "HydrogenCap <notifications@hydrogencap.com>",
             to: [userEmail],
             subject,
             html,
           });
 
           console.log(`Email sent to ${userEmail}: ${subject}`);
 
           // Log the notification
           await supabase.from('notification_log').insert({
             org_id: notification.org_id,
             user_id: notification.user_id,
             notification_type: 'compliance_reminder',
             reference_type: 'compliance_item',
             reference_id: notification.reference_id,
             channel: 'email',
             recipient: userEmail,
             subject,
             status: 'sent',
             sent_at: new Date().toISOString(),
           });
 
           // Update compliance item reminder tracking
           await supabase
             .from('compliance_items')
             .update({
               last_reminder_sent_at: new Date().toISOString(),
               reminder_count: (complianceItem.reminder_count || 0) + 1,
             })
             .eq('id', complianceItem.id);
         }
 
         // Mark notification as processed
         await supabase
           .from('scheduled_notifications')
           .update({ processed: true, processed_at: new Date().toISOString() })
           .eq('id', notification.id);
 
         results.push({ id: notification.id, status: 'sent' });
 
       } catch (err: any) {
         console.error(`Error processing notification ${notification.id}:`, err);
         
         // Log failure
         await supabase.from('notification_log').insert({
           org_id: notification.org_id,
           user_id: notification.user_id,
           notification_type: notification.notification_type,
           reference_type: notification.reference_type,
           reference_id: notification.reference_id,
           channel: 'email',
           recipient: 'unknown',
           status: 'failed',
           error_message: err.message,
         });
 
         results.push({ id: notification.id, status: 'failed', error: err.message });
       }
     }
 
     return new Response(JSON.stringify({ 
       processed: results.length, 
       results,
       timestamp: new Date().toISOString(),
     }), {
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
 
   } catch (error: any) {
     console.error('Error:', error);
     return new Response(JSON.stringify({ error: error.message }), {
       status: 500,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   }
 });