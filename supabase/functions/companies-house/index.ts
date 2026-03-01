import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

const CH_API_BASE = 'https://api.company-information.service.gov.uk';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // User client for auth verification
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service client for cache/sync operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const apiKey = Deno.env.get('COMPANIES_HOUSE_API_KEY')?.trim();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Companies House API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const chAuth = `Basic ${btoa(apiKey + ':')}`;
    const { action, company_number, entity_id, search_query } = await req.json();

    // Search action
    if (action === 'search' && search_query) {
      const url = `${CH_API_BASE}/search/companies?q=${encodeURIComponent(search_query)}&items_per_page=10`;
      const resp = await fetch(url, { headers: { Authorization: chAuth } });
      if (!resp.ok) {
        const text = await resp.text();
        return new Response(
          JSON.stringify({ error: `Companies House API error: ${resp.status}`, detail: text }),
          { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const data = await resp.json();
      return new Response(
        JSON.stringify({
          companies: data.items?.map((item: any) => ({
            company_number: item.company_number,
            company_name: item.title,
            company_status: item.company_status,
            date_of_creation: item.date_of_creation,
            address_snippet: item.address_snippet,
          })) || []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Profile, officers, filing_history actions
    if (!company_number) {
      return new Response(
        JSON.stringify({ error: 'company_number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache first (for non-force requests)
    if (entity_id && action !== 'search') {
      const { data: cached } = await adminClient
        .from('companies_house_cache')
        .select('*')
        .eq('entity_id', entity_id)
        .eq('data_type', action)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (cached) {
        return new Response(
          JSON.stringify({ data: cached.response_data, cached: true, fetched_at: cached.fetched_at }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let endpoint = '';
    switch (action) {
      case 'profile':
        endpoint = `/company/${company_number}`;
        break;
      case 'officers':
        endpoint = `/company/${company_number}/officers`;
        break;
      case 'filing_history':
        endpoint = `/company/${company_number}/filing-history?items_per_page=10`;
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: search, profile, officers, filing_history' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const resp = await fetch(`${CH_API_BASE}${endpoint}`, {
      headers: { Authorization: chAuth }
    });

    if (resp.status === 429) {
      if (entity_id) {
        await adminClient.from('companies_house_sync_log').insert({
          entity_id, company_number, sync_type: 'manual', status: 'rate_limited',
          error_message: 'Rate limited by Companies House'
        });
      }
      return new Response(
        JSON.stringify({ error: 'Rate limited by Companies House. Try again in a few minutes.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (resp.status === 404) {
      if (entity_id) {
        await adminClient.from('companies_house_sync_log').insert({
          entity_id, company_number, sync_type: 'manual', status: 'not_found',
          error_message: 'Company not found on Companies House register'
        });
      }
      return new Response(
        JSON.stringify({ error: 'Company not found', company_number }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!resp.ok) {
      const text = await resp.text();
      if (entity_id) {
        await adminClient.from('companies_house_sync_log').insert({
          entity_id, company_number, sync_type: 'manual', status: 'failed',
          error_message: `API error: ${resp.status} - ${text}`
        });
      }
      return new Response(
        JSON.stringify({ error: `Companies House API error: ${resp.status}` }),
        { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await resp.json();

    // Cache the response and log sync
    if (entity_id) {
      const now = new Date().toISOString();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await adminClient.from('companies_house_cache').upsert({
        entity_id,
        company_number,
        data_type: action,
        response_data: data,
        fetched_at: now,
        expires_at: expires,
      }, { onConflict: 'entity_id,data_type' });

      await adminClient.from('companies_house_sync_log').insert({
        entity_id, company_number, sync_type: 'manual', status: 'success'
      });
    }

    return new Response(
      JSON.stringify({ data, cached: false, fetched_at: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Companies House function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
