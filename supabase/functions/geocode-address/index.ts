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

    // Use OpenStreetMap Nominatim API (free, no API key required)
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&addressdetails=1&limit=1&countrycodes=gb`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PropertyPortfolio/1.0 (geocoding service)',
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      console.error(`Nominatim API error: ${response.status}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Geocoding service error: ${response.status}` 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data: NominatimResult[] = await response.json();

    if (!data || data.length === 0) {
      console.log(`No results found for: ${address}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No results found for this address" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = data[0];
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

    // Postcode
    const postcode = addr.postcode || null;

    // Country
    const country = addr.country || "United Kingdom";

    // Determine confidence based on result type and importance
    let geocodeConfidence: 'exact' | 'approximate' | 'unknown' = 'unknown';
    const importance = result.importance || 0;
    const resultType = result.type || '';
    
    // High confidence for specific address matches
    if (resultType === 'house' || resultType === 'building' || resultType === 'residential') {
      geocodeConfidence = 'exact';
    } else if (importance > 0.5 || resultType === 'street' || resultType === 'road') {
      geocodeConfidence = 'approximate';
    } else if (importance > 0.3) {
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

    console.log(`Geocoding successful: lat=${geocodeResult.data?.latitude}, lng=${geocodeResult.data?.longitude}`);

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
