import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function normalizeAddress(addr: string): string {
  return addr.toLowerCase().replace(/[,.']/g, '').replace(/\s+/g, ' ').trim();
}

function addressSimilarity(addr1: string, addr2: string): number {
  const tokens1 = new Set(normalizeAddress(addr1).split(' '));
  const tokens2 = new Set(normalizeAddress(addr2).split(' '));
  let matches = 0;
  for (const t of tokens1) { if (tokens2.has(t)) matches++; }
  return matches / Math.max(tokens1.size, tokens2.size);
}

function calculateEPCExpiry(lodgementDate: string): string {
  const d = new Date(lodgementDate);
  d.setFullYear(d.getFullYear() + 10);
  return d.toISOString().split('T')[0];
}

async function fetchEPC(postcode: string, addressLine: string) {
  try {
    const clean = postcode.replace(/\s+/g, '').toUpperCase();
    const url = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${encodeURIComponent(clean)}&size=100`;
    const apiKey = Deno.env.get('EPC_API_KEY');
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (apiKey) {
      // EPC API expects Basic auth with the token as-is (already base64 from the site)
      // or email:key pair base64-encoded
      headers['Authorization'] = `Basic ${btoa(apiKey)}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text();
      console.error(`EPC API ${res.status} for ${clean}: ${body.substring(0, 200)}`);
      return null;
    }
    const data = await res.json();
    if (!data.rows?.length) {
      console.log(`No EPC rows found for postcode ${clean}`);
      return null;
    }

    let best = data.rows[0], bestScore = 0;
    for (const row of data.rows) {
      const score = addressSimilarity(addressLine, row.address || '');
      if (score > bestScore) { bestScore = score; best = row; }
    }

    return {
      epcRating: best['current-energy-rating'] || null,
      expiryDate: best['lodgement-date'] ? calculateEPCExpiry(best['lodgement-date']) : null,
      constructionAgeBand: best['construction-age-band'] || null,
      propertyType: best['property-type'] || null,
    };
  } catch (e) {
    console.error('EPC fetch error for', postcode, e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: { user }, error: authErr } = await createClient(
      supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: membership } = await supabase
      .from('memberships').select('org_id').eq('user_id', user.id).limit(1).maybeSingle();

    if (!membership?.org_id) {
      return new Response(JSON.stringify({ error: 'No organization' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { mode } = await req.json();

    let query = supabase
      .from('properties_v2')
      .select('id, address_line_1, postcode, epc_rating')
      .eq('org_id', membership.org_id)
      .not('postcode', 'is', null);

    if (mode === 'missing-only') {
      query = query.is('epc_rating', null);
    }

    const { data: properties, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    console.log(`Processing ${properties?.length || 0} V2 properties for EPC`);

    let updated = 0, failed = 0;
    const results: any[] = [];

    for (const p of properties || []) {
      if (!p.postcode) { failed++; continue; }
      await new Promise(r => setTimeout(r, 200));

      const epc = await fetchEPC(p.postcode, p.address_line_1);
      if (epc?.epcRating) {
        const { error: updErr } = await supabase
          .from('properties_v2')
          .update({
            epc_rating: epc.epcRating,
            epc_expiry_date: epc.expiryDate,
          })
          .eq('id', p.id);

        if (updErr) { failed++; } else {
          updated++;
          results.push({ id: p.id, address: p.address_line_1, epcRating: epc.epcRating, expiryDate: epc.expiryDate });
        }
      } else { failed++; }
    }

    return new Response(JSON.stringify({ success: true, total: properties?.length || 0, updated, failed, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Bulk EPC V2 error:', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
