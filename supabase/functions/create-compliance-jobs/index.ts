 import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
 const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 
 serve(async (req) => {
   // Handle CORS preflight requests
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
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
 
     // Update priorities for existing jobs
     const { data: prioritiesUpdated, error: priorityError } = await supabase
       .rpc('update_job_priorities');
 
     if (priorityError) {
       console.error('Error updating priorities:', priorityError);
       throw priorityError;
     }
 
     console.log(`Updated ${prioritiesUpdated} job priorities`);
 
     return new Response(JSON.stringify({
       success: true,
       jobs_created: jobsCreated,
       priorities_updated: prioritiesUpdated,
     }), {
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
 
   } catch (error) {
     console.error('Error in create-compliance-jobs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
   }
 });