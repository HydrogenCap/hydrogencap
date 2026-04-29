import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { withInvocationLog } from "../_shared/logger.ts";
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
      // Try to detect if the key is already base64 or raw email:key
      const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(apiKey.trim());
      const token = isBase64 ? apiKey.trim() : btoa(apiKey.trim());
      headers['Authorization'] = `Basic ${token}`;
      console.log(`EPC Auth: using ${isBase64 ? 'pre-encoded' : 'raw'} token, length=${token.length}`);
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

Deno.serve(withInvocationLog("bulk-epc-enrich-v2", async (req, _invocationLog) => {
  const corsHeaders = getCorsHeaders(req);
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

    // Accept `org_id` from the body so multi-org users can pick which portfolio
    // to enrich. If omitted we fall back to every org the user is a member of —
    // previously this silently picked only the FIRST org via .limit(1) and left
    // the other portfolios un-enriched.
    const body = await req.json().catch(() => ({}));
    const requestedOrgId: string | null = body?.org_id ?? null;
    const mode: string | undefined = body?.mode;

    const { data: memberships } = await supabase
      .from('memberships').select('org_id').eq('user_id', user.id);

    const allowedOrgIds = (memberships ?? [])
      .map((m: { org_id: string }) => m.org_id);

    if (allowedOrgIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No organization' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let targetOrgIds: string[];
    if (requestedOrgId) {
      if (!allowedOrgIds.includes(requestedOrgId)) {
        return new Response(JSON.stringify({ error: 'Forbidden: not a member of this org' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      targetOrgIds = [requestedOrgId];
    } else {
      targetOrgIds = allowedOrgIds;
    }

    let query = supabase
      .from('properties_v2')
      .select('id, address_line_1, postcode, epc_rating, org_id')
      .in('org_id', targetOrgIds)
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
        const lodgementDate = epc.expiryDate
          ? new Date(new Date(epc.expiryDate).getTime() - 10 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        const { error: updErr } = await supabase
          .from('properties_v2')
          .update({
            epc_rating: epc.epcRating,
            epc_expiry_date: epc.expiryDate,
          })
          .eq('id', p.id);

        if (updErr) { failed++; continue; }

        // Mark any existing EPC docs as superseded
        await supabase
          .from('compliance_documents_v2')
          .update({ is_current: false })
          .eq('property_id', p.id)
          .eq('document_type', 'epc')
          .eq('is_current', true);

        // Insert compliance document for the EPC — use the property's own
        // org_id since we may be processing multiple orgs in one run.
        await supabase
          .from('compliance_documents_v2')
          .insert({
            org_id: p.org_id,
            property_id: p.id,
            document_type: 'epc',
            issue_date: lodgementDate,
            expiry_date: epc.expiryDate,
            status: epc.expiryDate && new Date(epc.expiryDate) < new Date() ? 'expired'
              : epc.expiryDate && new Date(epc.expiryDate) <= new Date(Date.now() + 90 * 86400000) ? 'expiring_soon'
              : 'valid',
            is_current: true,
            notes: `EPC Rating: ${epc.epcRating}. Auto-enriched from EPC Register.`,
          });

        updated++;
        results.push({ id: p.id, address: p.address_line_1, epcRating: epc.epcRating, expiryDate: epc.expiryDate });
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
}));
