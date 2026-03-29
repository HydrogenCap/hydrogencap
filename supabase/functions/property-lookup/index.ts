import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

interface PropertyLookupRequest {
  postcode: string;
  addressLine?: string;
}

interface EPCData {
  epcRating?: string;
  propertyType?: string;
  builtYear?: number;
  constructionAgeBand?: string;
  tenure?: string;
  floorArea?: number;
  bedrooms?: number;
  address?: string;
  lodgementDate?: string;
  expiryDate?: string;
}

interface PostcodeData {
  localAuthority?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  postcodeArea?: string;
}

interface CouncilTaxData {
  councilTaxBand?: string;
}

interface LookupResult {
  success: boolean;
  epc?: EPCData;
  location?: PostcodeData;
  councilTax?: CouncilTaxData;
  errors?: string[];
  fieldsPopulated: string[];
}

// Normalize address for matching
function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[,.']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate address similarity (simple token matching)
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

// Fetch EPC data from Open Data Communities API
async function fetchEPCData(postcode: string, addressLine?: string): Promise<EPCData | null> {
  try {
    // Clean postcode for API
    const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
    
    // EPC Open Data API - no key required
    const url = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${encodeURIComponent(cleanPostcode)}&size=100`;
    
    console.log('Fetching EPC data:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('EPC API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    
    if (!data.rows || data.rows.length === 0) {
      console.log('No EPC records found for postcode:', cleanPostcode);
      return null;
    }

    // Find best matching address
    let bestMatch = data.rows[0];
    let bestScore = 0;
    
    if (addressLine) {
      for (const row of data.rows) {
        const score = addressSimilarity(addressLine, row.address || '');
        if (score > bestScore) {
          bestScore = score;
          bestMatch = row;
        }
      }
      console.log('Best address match score:', bestScore, 'for:', bestMatch.address);
    }

    // Map EPC property types to our schema
    const propertyTypeMap: Record<string, string> = {
      'House': 'House',
      'Flat': 'Flat',
      'Maisonette': 'Maisonette',
      'Bungalow': 'Bungalow',
      'Park home': 'Other',
    };

    // Map tenure
    const tenureMap: Record<string, string> = {
      'owner-occupied': 'Freehold',
      'rental (social)': 'Leasehold',
      'rental (private)': 'Leasehold',
    };

    // Parse construction age band to approximate year
    let builtYear: number | undefined;
    const ageBand = bestMatch['construction-age-band'];
    if (ageBand) {
      // Extract years from strings like "1967-1975" or "before 1900"
      const yearMatch = ageBand.match(/(\d{4})/);
      if (yearMatch) {
        builtYear = parseInt(yearMatch[1]);
      }
    }

    return {
      epcRating: bestMatch['current-energy-rating'],
      propertyType: propertyTypeMap[bestMatch['property-type']] || bestMatch['property-type'],
      builtYear,
      constructionAgeBand: ageBand,
      tenure: tenureMap[bestMatch.tenure?.toLowerCase()] || undefined,
      floorArea: bestMatch['total-floor-area'] ? parseFloat(bestMatch['total-floor-area']) : undefined,
      bedrooms: bestMatch['number-habitable-rooms'] ? parseInt(bestMatch['number-habitable-rooms']) : undefined,
      address: bestMatch.address,
      lodgementDate: bestMatch['lodgement-date'],
      expiryDate: bestMatch['lodgement-date'] ? calculateEPCExpiry(bestMatch['lodgement-date']) : undefined,
    };
  } catch (error) {
    console.error('Error fetching EPC data:', error);
    return null;
  }
}

function calculateEPCExpiry(lodgementDate: string): string {
  const date = new Date(lodgementDate);
  date.setFullYear(date.getFullYear() + 10);
  return date.toISOString().split('T')[0];
}

// Fetch postcode data from Postcodes.io (free, no key)
async function fetchPostcodeData(postcode: string): Promise<PostcodeData | null> {
  try {
    const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
    const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(cleanPostcode)}`;
    
    console.log('Fetching postcode data:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Postcodes.io error:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.status !== 200 || !data.result) {
      return null;
    }

    const result = data.result;
    
    return {
      localAuthority: result.admin_district,
      county: result.admin_county || result.region,
      latitude: result.latitude,
      longitude: result.longitude,
      postcodeArea: result.outcode,
    };
  } catch (error) {
    console.error('Error fetching postcode data:', error);
    return null;
  }
}

// Fetch council tax band using Firecrawl
async function fetchCouncilTaxData(postcode: string, addressLine?: string): Promise<CouncilTaxData | null> {
  try {
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      console.log('Firecrawl API key not configured, skipping council tax lookup');
      return null;
    }

    // Use GOV.UK council tax checker
    const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
    const searchUrl = `https://www.tax.service.gov.uk/check-council-tax-band/search?postcode=${encodeURIComponent(cleanPostcode)}`;
    
    console.log('Fetching council tax data via Firecrawl:', searchUrl);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 2000,
      }),
    });

    if (!response.ok) {
      console.error('Firecrawl error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';
    
    // Parse council tax band from the page content
    // Look for patterns like "Band A", "Band B", etc.
    const bandMatch = markdown.match(/Band\s+([A-H])/i);
    
    if (bandMatch) {
      return {
        councilTaxBand: bandMatch[1].toUpperCase(),
      };
    }
    
    // Try alternative patterns
    const altMatch = markdown.match(/council\s+tax\s+band[:\s]+([A-H])/i);
    if (altMatch) {
      return {
        councilTaxBand: altMatch[1].toUpperCase(),
      };
    }
    
    console.log('Could not extract council tax band from page');
    return null;
  } catch (error) {
    console.error('Error fetching council tax data:', error);
    return null;
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Verify user is authenticated
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { postcode, addressLine } = await req.json() as PropertyLookupRequest;

    if (!postcode) {
      return new Response(
        JSON.stringify({ success: false, error: 'Postcode is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof postcode !== 'string' || postcode.length > 10) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid postcode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (addressLine !== undefined && (typeof addressLine !== 'string' || addressLine.length > 200)) {
      return new Response(
        JSON.stringify({ success: false, error: 'addressLine must be 200 characters or fewer' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Property lookup for:', postcode, addressLine);

    // Fetch all data sources in parallel
    const [epcData, postcodeData, councilTaxData] = await Promise.all([
      fetchEPCData(postcode, addressLine),
      fetchPostcodeData(postcode),
      fetchCouncilTaxData(postcode, addressLine),
    ]);

    const fieldsPopulated: string[] = [];
    const errors: string[] = [];

    // Track which fields we got
    if (epcData) {
      if (epcData.epcRating) fieldsPopulated.push('EPC Rating');
      if (epcData.propertyType) fieldsPopulated.push('Property Type');
      if (epcData.builtYear) fieldsPopulated.push('Built Year');
      if (epcData.tenure) fieldsPopulated.push('Tenure');
      if (epcData.bedrooms) fieldsPopulated.push('Bedrooms');
      if (epcData.constructionAgeBand) fieldsPopulated.push('Construction Age Band');
    } else {
      errors.push('No EPC data found for this address');
    }

    if (postcodeData) {
      if (postcodeData.localAuthority) fieldsPopulated.push('Local Authority');
      if (postcodeData.county) fieldsPopulated.push('County');
      if (postcodeData.latitude) fieldsPopulated.push('Coordinates');
    } else {
      errors.push('Invalid postcode');
    }

    if (councilTaxData?.councilTaxBand) {
      fieldsPopulated.push('Council Tax Band');
    }

    const result: LookupResult = {
      success: fieldsPopulated.length > 0,
      epc: epcData || undefined,
      location: postcodeData || undefined,
      councilTax: councilTaxData || undefined,
      errors: errors.length > 0 ? errors : undefined,
      fieldsPopulated,
    };

    console.log('Lookup result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Property lookup error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
