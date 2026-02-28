 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
 
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
 
 const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
 const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: getCorsHeaders(req) });
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

     console.log('Starting auto-job creation for expiring compliance items');
 
     const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
 
     // Create jobs for expiring compliance
     const { data: jobsCreated, error: createError } = await supabase
       .rpc('create_jobs_for_expiring_compliance');

     if (createError) {
       console.error('Error creating jobs:', createError);
       throw createError;
     }

     console.log(`Created ${jobsCreated} new jobs`);

     const { data: prioritiesUpdated, error: priorityError } = await supabase
       .rpc('update_job_priorities');

     if (priorityError) {
       console.error('Error updating priorities:', priorityError);
       throw priorityError;
     }

      console.log(`Updated ${prioritiesUpdated} job priorities`);

      const { data: cancelledCount, error: cancelError } = await supabase
        .rpc('cancel_renewed_compliance_jobs');

      if (cancelError) {
        console.error('Error cancelling renewed jobs:', cancelError);
      }

      console.log(`Cancelled ${cancelledCount ?? 0} jobs for renewed compliance items`);

      return new Response(JSON.stringify({
        success: true,
        jobs_created: jobsCreated,
        priorities_updated: prioritiesUpdated,
        jobs_cancelled: cancelledCount ?? 0,
      }), {
       headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
     });
 
   } catch (error) {
     console.error('Error in create-compliance-jobs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
       status: 500,
       headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
     });
   }
 });
