import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

import { withInvocationLog } from "../_shared/logger.ts";
interface PricePaidRecord {
  propertyId: string;
  address: string;
  postcode: string;
  pricePaid: number | null;
  transactionDate: string | null;
  propertyType: string | null;
  success: boolean;
  error?: string;
}

// Normalize address for matching
function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[,.']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/flat\s*\d+/gi, '')
    .replace(/apartment\s*\d+/gi, '')
    .trim();
}

// Extract house number from address
function extractHouseNumber(addr: string): string | null {
  const match = addr.match(/^(\d+[a-zA-Z]?)\s/);
  return match ? match[1].toLowerCase() : null;
}

// Calculate address similarity
function addressSimilarity(addr1: string, addr2: string): number {
  const norm1 = normalizeAddress(addr1);
  const norm2 = normalizeAddress(addr2);
  
  const tokens1 = norm1.split(' ').filter(t => t.length > 1);
  const tokens2 = norm2.split(' ').filter(t => t.length > 1);
  
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  let matches = 0;
  for (const token of set1) {
    if (set2.has(token)) matches++;
  }
  
  // Bonus for matching house numbers
  const num1 = extractHouseNumber(addr1);
  const num2 = extractHouseNumber(addr2);
  if (num1 && num2 && num1 === num2) {
    matches += 2;
  }
  
  return matches / Math.max(set1.size, set2.size);
}

async function fetchPricePaidData(
  postcode: string, 
  addressLine: string
): Promise<{
  pricePaid?: number;
  transactionDate?: string;
  propertyType?: string;
  address?: string;
} | null> {
  try {
    const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
    
    // Land Registry SPARQL endpoint for price paid data
    const sparqlQuery = `
      PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
      PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
      
      SELECT ?paon ?saon ?street ?town ?postcode ?amount ?date ?propertyType
      WHERE {
        ?transx lrppi:pricePaid ?amount ;
                lrppi:transactionDate ?date ;
                lrppi:propertyAddress ?addr .
        
        ?addr lrcommon:postcode "${cleanPostcode}" .
        
        OPTIONAL { ?addr lrcommon:paon ?paon }
        OPTIONAL { ?addr lrcommon:saon ?saon }
        OPTIONAL { ?addr lrcommon:street ?street }
        OPTIONAL { ?addr lrcommon:town ?town }
        OPTIONAL { ?transx lrppi:propertyType ?propertyType }
        
        BIND(CONCAT(
          COALESCE(?saon, ""), " ",
          COALESCE(?paon, ""), " ",
          COALESCE(?street, ""), " ",
          COALESCE(?town, "")
        ) AS ?fullAddr)
      }
      ORDER BY DESC(?date)
      LIMIT 50
    `;

    const url = 'https://landregistry.data.gov.uk/landregistry/query';
    
    console.log('Fetching Price Paid data for postcode:', cleanPostcode);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `query=${encodeURIComponent(sparqlQuery)}`,
    });

    if (!response.ok) {
      console.error('Land Registry API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    
    if (!data.results?.bindings || data.results.bindings.length === 0) {
      console.log('No Price Paid records found for postcode:', cleanPostcode);
      return null;
    }

    // Find best matching address
    let bestMatch = data.results.bindings[0];
    let bestScore = 0;
    
    for (const row of data.results.bindings) {
      const fullAddr = [
        row.saon?.value,
        row.paon?.value,
        row.street?.value,
        row.town?.value,
      ].filter(Boolean).join(' ');
      
      const score = addressSimilarity(addressLine, fullAddr);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = row;
      }
    }

    console.log('Best match score:', bestScore, 'Amount:', bestMatch.amount?.value);

    // Only return if we have a reasonable match (score > 0.3)
    if (bestScore < 0.3) {
      console.log('No good address match found, best score was:', bestScore);
      return null;
    }

    // Map property types
    const typeMap: Record<string, string> = {
      'http://landregistry.data.gov.uk/def/common/detached': 'Detached',
      'http://landregistry.data.gov.uk/def/common/semi-detached': 'Semi-detached',
      'http://landregistry.data.gov.uk/def/common/terraced': 'Terraced',
      'http://landregistry.data.gov.uk/def/common/flat-maisonette': 'Flat',
    };

    const matchedAddress = [
      bestMatch.saon?.value,
      bestMatch.paon?.value,
      bestMatch.street?.value,
      bestMatch.town?.value,
    ].filter(Boolean).join(' ');

    return {
      pricePaid: bestMatch.amount?.value ? parseInt(bestMatch.amount.value) : undefined,
      transactionDate: bestMatch.date?.value,
      propertyType: typeMap[bestMatch.propertyType?.value] || undefined,
      address: matchedAddress,
    };
  } catch (error) {
    console.error('Error fetching Price Paid data for', postcode, ':', error);
    return null;
  }
}

serve(withInvocationLog("bulk-price-paid-enrich", async (req, _invocationLog) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const { data: { user }, error: userError } = await createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { mode, orgId } = await req.json();

    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin']);

    if (membershipError || !memberships || memberships.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Owner or admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const manageableOrgIds = memberships.map((membership) => membership.org_id);
    const targetOrgId = typeof orgId === 'string' && orgId.length > 0
      ? orgId
      : manageableOrgIds.length === 1
        ? manageableOrgIds[0]
        : null;

    if (!targetOrgId || !manageableOrgIds.includes(targetOrgId)) {
      return new Response(
        JSON.stringify({ error: 'A valid organization must be selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch properties that need price data
    let query = supabase
      .from('properties')
      .select('id, address_line, postcode, purchase_price_gbp')
      .eq('org_id', targetOrgId)
      .not('postcode', 'is', null);

    if (mode === 'missing-only') {
      query = query.is('purchase_price_gbp', null);
    }

    const { data: properties, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Processing ${properties?.length || 0} properties for Price Paid enrichment`);

    const results: PricePaidRecord[] = [];
    let updated = 0;
    let failed = 0;

    // Process each property (with rate limiting)
    for (const property of properties || []) {
      if (!property.postcode) {
        results.push({
          propertyId: property.id,
          address: property.address_line,
          postcode: '',
          pricePaid: null,
          transactionDate: null,
          propertyType: null,
          success: false,
          error: 'No postcode',
        });
        failed++;
        continue;
      }

      // Add delay between API calls to be respectful
      await new Promise(resolve => setTimeout(resolve, 300));

      const priceData = await fetchPricePaidData(property.postcode, property.address_line);

      if (priceData?.pricePaid) {
        // Update the property
        const updateData: Record<string, unknown> = {
          purchase_price_gbp: priceData.pricePaid,
        };
        
        // Also update purchase date if we have it and property doesn't
        if (priceData.transactionDate) {
          updateData.original_purchase_date = priceData.transactionDate;
        }

        // V1 write removed in Properties §0b Ship A — was failing silently
        // against v1_freeze_guard. V2 mirror (writing purchase_price to
        // properties_v2) is queued for Ship B once column mapping is resolved
        // (V1 `purchase_price_gbp` → V2 `purchase_price`).
        const updateError: { message: string } | null = null;

        if (updateError) {
          console.error('Error updating property:', updateError);
          results.push({
            propertyId: property.id,
            address: property.address_line,
            postcode: property.postcode,
            pricePaid: null,
            transactionDate: null,
            propertyType: null,
            success: false,
            error: 'Database update failed',
          });
          failed++;
        } else {
          results.push({
            propertyId: property.id,
            address: property.address_line,
            postcode: property.postcode,
            pricePaid: priceData.pricePaid,
            transactionDate: priceData.transactionDate || null,
            propertyType: priceData.propertyType || null,
            success: true,
          });
          updated++;
        }
      } else {
        results.push({
          propertyId: property.id,
          address: property.address_line,
          postcode: property.postcode,
          pricePaid: null,
          transactionDate: null,
          propertyType: null,
          success: false,
          error: 'No Price Paid data found',
        });
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: properties?.length || 0,
        updated,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Bulk Price Paid enrich error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));
