import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

import { withInvocationLog } from "../_shared/logger.ts";
interface EPCRecord {
  propertyId: string;
  address: string;
  postcode: string;
  epcRating: string | null;
  expiryDate: string | null;
  propertyType: string | null;
  tenure: string | null;
  constructionAgeBand: string | null;
  success: boolean;
  error?: string;
}

// Normalize address for matching
function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[,.']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate address similarity
function addressSimilarity(addr1: string, addr2: string): number {
  const tokens1 = normalizeAddress(addr1).split(' ');
  const tokens2 = normalizeAddress(addr2).split(' ');
  
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  let matches = 0;
  for (const token of set1) {
    if (set2.has(token)) matches++;
  }
  
  return matches / Math.max(set1.size, set2.size);
}

function calculateEPCExpiry(lodgementDate: string): string {
  const date = new Date(lodgementDate);
  date.setFullYear(date.getFullYear() + 10);
  return date.toISOString().split('T')[0];
}

async function fetchEPCForProperty(
  postcode: string, 
  addressLine: string
): Promise<{
  epcRating?: string;
  expiryDate?: string;
  propertyType?: string;
  tenure?: string;
  constructionAgeBand?: string;
} | null> {
  try {
    const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
    const url = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${encodeURIComponent(cleanPostcode)}&size=100`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.error('EPC API error for', cleanPostcode, ':', response.status);
      return null;
    }

    const data = await response.json();
    
    if (!data.rows || data.rows.length === 0) {
      return null;
    }

    // Find best matching address
    let bestMatch = data.rows[0];
    let bestScore = 0;
    
    for (const row of data.rows) {
      const score = addressSimilarity(addressLine, row.address || '');
      if (score > bestScore) {
        bestScore = score;
        bestMatch = row;
      }
    }

    // Map tenure
    const tenureMap: Record<string, string> = {
      'owner-occupied': 'Freehold',
      'rental (social)': 'Leasehold',
      'rental (private)': 'Leasehold',
    };

    return {
      epcRating: bestMatch['current-energy-rating'],
      expiryDate: bestMatch['lodgement-date'] ? calculateEPCExpiry(bestMatch['lodgement-date']) : undefined,
      propertyType: bestMatch['property-type'],
      tenure: tenureMap[bestMatch.tenure?.toLowerCase()] || undefined,
      constructionAgeBand: bestMatch['construction-age-band'],
    };
  } catch (error) {
    console.error('Error fetching EPC for', postcode, ':', error);
    return null;
  }
}

serve(withInvocationLog("bulk-epc-enrich", async (req, log) => {
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

    // Fetch properties that need EPC data
    let query = supabase
      .from('properties')
      .select('id, address_line, postcode, epc_rating')
      .eq('org_id', targetOrgId)
      .not('postcode', 'is', null);

    if (mode === 'missing-only') {
      query = query.is('epc_rating', null);
    }

    const { data: properties, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Processing ${properties?.length || 0} properties for EPC enrichment`);

    const results: EPCRecord[] = [];
    let updated = 0;
    let failed = 0;

    // Process each property (with rate limiting to avoid API overload)
    for (const property of properties || []) {
      if (!property.postcode) {
        results.push({
          propertyId: property.id,
          address: property.address_line,
          postcode: '',
          epcRating: null,
          expiryDate: null,
          propertyType: null,
          tenure: null,
          constructionAgeBand: null,
          success: false,
          error: 'No postcode',
        });
        failed++;
        continue;
      }

      // Add small delay between API calls to be respectful
      await new Promise(resolve => setTimeout(resolve, 200));

      const epcData = await fetchEPCForProperty(property.postcode, property.address_line);

      if (epcData?.epcRating) {
        // Update the property
        const { error: updateError } = await supabase
          .from('properties')
          .update({
            epc_rating: epcData.epcRating,
            tenure: epcData.tenure || undefined,
          })
          .eq('id', property.id);

        if (updateError) {
          console.error('Error updating property:', updateError);
          results.push({
            propertyId: property.id,
            address: property.address_line,
            postcode: property.postcode,
            epcRating: null,
            expiryDate: null,
            propertyType: null,
            tenure: null,
            constructionAgeBand: null,
            success: false,
            error: 'Database update failed',
          });
          failed++;
        } else {
          // === EPC CONSOLIDATION: Also upsert compliance_items record ===
          if (epcData.expiryDate) {
            // Check if EPC compliance item exists for this property
            const { data: existingEpc } = await supabase
              .from('compliance_items')
              .select('id')
              .eq('property_id', property.id)
              .eq('compliance_type', 'EPC')
              .maybeSingle();

            // Calculate issue date (10 years before expiry)
            const expiryDateObj = new Date(epcData.expiryDate);
            const issueDateObj = new Date(expiryDateObj);
            issueDateObj.setFullYear(issueDateObj.getFullYear() - 10);
            const issueDate = issueDateObj.toISOString().split('T')[0];

            if (existingEpc) {
              // Update existing EPC compliance item
              await supabase
                .from('compliance_items')
                .update({
                  expiry_date: epcData.expiryDate,
                  issue_date: issueDate,
                  notes: `Auto-enriched from EPC API. Rating: ${epcData.epcRating}`,
                })
                .eq('id', existingEpc.id);
            } else {
              // Create new EPC compliance item
              await supabase
                .from('compliance_items')
                .insert({
                  property_id: property.id,
                  org_id: targetOrgId,
                  compliance_type: 'EPC',
                  expiry_date: epcData.expiryDate,
                  issue_date: issueDate,
                  responsible_party: 'Owner',
                  notes: `Auto-enriched from EPC API. Rating: ${epcData.epcRating}`,
                  reminder_days: [90, 60, 30, 0],
                });
            }
          }

          results.push({
            propertyId: property.id,
            address: property.address_line,
            postcode: property.postcode,
            epcRating: epcData.epcRating,
            expiryDate: epcData.expiryDate || null,
            propertyType: epcData.propertyType || null,
            tenure: epcData.tenure || null,
            constructionAgeBand: epcData.constructionAgeBand || null,
            success: true,
          });
          updated++;
        }
      } else {
        results.push({
          propertyId: property.id,
          address: property.address_line,
          postcode: property.postcode,
          epcRating: null,
          expiryDate: null,
          propertyType: null,
          tenure: null,
          constructionAgeBand: null,
          success: false,
          error: 'No EPC data found',
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
    console.error('Bulk EPC enrich error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));
