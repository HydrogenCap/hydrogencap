import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GeocodeRequest {
  address: string;
  placeId?: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
  type?: string;
  importance?: number;
}

interface GeocodeResult {
  success: boolean;
  data?: {
    place_id: string;
    formatted_address: string;
    latitude: number;
    longitude: number;
    address_line1: string;
    address_line2: string | null;
    town_city: string | null;
    county: string | null;
    postcode: string | null;
    country: string;
    geocode_confidence: 'exact' | 'approximate' | 'unknown';
  };
  error?: string;
}

// Extract postcode from address string (UK postcodes)
function extractPostcode(address: string): string | null {
  // UK postcode regex - matches formats like "OX3 8LW", "SW1A 1AA", etc.
  const postcodeRegex = /\b([A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2})\b/i;
  const match = address.match(postcodeRegex);
  return match ? match[1].toUpperCase() : null;
}

// Clean address by removing duplicate postcodes and building names
function cleanAddress(address: string): string {
  // Remove "United Kingdom" as Nominatim handles country codes
  let cleaned = address.replace(/,?\s*United Kingdom\s*$/i, '');
  
  // Extract and deduplicate postcode
  const postcode = extractPostcode(cleaned);
  if (postcode) {
    // Remove all occurrences of the postcode
    const postcodeRegex = new RegExp(postcode.replace(/\s+/g, '\\s*'), 'gi');
    cleaned = cleaned.replace(postcodeRegex, '');
    // Add postcode back once at the end
    cleaned = cleaned.replace(/,\s*,/g, ',').replace(/,\s*$/, '').trim();
    cleaned = `${cleaned}, ${postcode}`;
  }
  
  // Clean up multiple commas and spaces
  cleaned = cleaned.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// Try geocoding with Nominatim
async function geocodeWithNominatim(query: string): Promise<NominatimResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1&countrycodes=gb`;
  
  console.log(`Trying Nominatim query: ${query}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'PropertyPortfolio/1.0 (geocoding service)',
      'Accept': 'application/json',
    }
  });

  if (!response.ok) {
    console.error(`Nominatim API error: ${response.status}`);
    return null;
  }

  const data: NominatimResult[] = await response.json();
  return data && data.length > 0 ? data[0] : null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address }: GeocodeRequest = await req.json();

    if (!address) {
      return new Response(
        JSON.stringify({ success: false, error: "Address required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Geocoding address: ${address}`);

    // Strategy 1: Try cleaned full address
    const cleanedAddress = cleanAddress(address);
    let result = await geocodeWithNominatim(cleanedAddress);

    // Strategy 2: If no result, try with just street + postcode
    if (!result) {
      const postcode = extractPostcode(address);
      if (postcode) {
        // Extract first line of address (street)
        const firstLine = address.split(',')[0].trim();
        const streetAndPostcode = `${firstLine}, ${postcode}, UK`;
        result = await geocodeWithNominatim(streetAndPostcode);
      }
    }

    // Strategy 3: If still no result, try postcode only (will give approximate location)
    if (!result) {
      const postcode = extractPostcode(address);
      if (postcode) {
        result = await geocodeWithNominatim(`${postcode}, UK`);
      }
    }

    // Strategy 4: Try town/city from address if available
    if (!result) {
      const parts = address.split(',').map(p => p.trim());
      // Look for parts that might be town names (not postcodes, not "United Kingdom")
      for (const part of parts) {
        if (part && !extractPostcode(part) && !part.match(/united kingdom/i) && part.length > 2) {
          result = await geocodeWithNominatim(`${part}, UK`);
          if (result) break;
        }
      }
    }

    if (!result) {
      console.log(`No results found for: ${address}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No results found for this address" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const addr = result.address || {};

    console.log(`Found result: ${result.display_name}`);

    // Build address line 1
    let addressLine1 = "";
    if (addr.house_number) addressLine1 += addr.house_number + " ";
    if (addr.road) addressLine1 += addr.road;
    addressLine1 = addressLine1.trim();
    
    // Fallback to first part of display name if no structured address
    if (!addressLine1) {
      addressLine1 = result.display_name.split(",")[0].trim();
    }

    // Address line 2 - neighbourhood or suburb
    const addressLine2 = addr.neighbourhood || addr.suburb || null;

    // Town/city - try multiple fields
    const townCity = addr.city || addr.town || addr.village || null;

    // County
    const county = addr.county || addr.state || null;

    // Postcode - prefer from result, fallback to extracted
    const postcode = addr.postcode || extractPostcode(address) || null;

    // Country
    const country = addr.country || "United Kingdom";

    // Determine confidence based on result type and what query succeeded
    let geocodeConfidence: 'exact' | 'approximate' | 'unknown' = 'unknown';
    const importance = result.importance || 0;
    const resultType = result.type || '';
    
    // High confidence for specific address matches
    if (resultType === 'house' || resultType === 'building' || resultType === 'residential') {
      geocodeConfidence = 'exact';
    } else if (addr.house_number && addr.road) {
      geocodeConfidence = 'exact';
    } else if (importance > 0.5 || resultType === 'street' || resultType === 'road') {
      geocodeConfidence = 'approximate';
    } else if (addr.postcode) {
      // Postcode-level match
      geocodeConfidence = 'approximate';
    } else {
      geocodeConfidence = 'approximate';
    }

    const geocodeResult: GeocodeResult = {
      success: true,
      data: {
        place_id: result.place_id.toString(),
        formatted_address: result.display_name,
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        address_line1: addressLine1,
        address_line2: addressLine2,
        town_city: townCity,
        county: county,
        postcode: postcode,
        country: country,
        geocode_confidence: geocodeConfidence,
      },
    };

    console.log(`Geocoding successful: lat=${geocodeResult.data?.latitude}, lng=${geocodeResult.data?.longitude}, confidence=${geocodeConfidence}`);

    return new Response(JSON.stringify(geocodeResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Geocode error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
