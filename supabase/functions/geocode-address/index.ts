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

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
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

function extractAddressComponent(
  components: AddressComponent[],
  type: string
): string | null {
  const component = components.find((c) => c.types.includes(type));
  return component?.long_name || null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Google Maps API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { address, placeId }: GeocodeRequest = await req.json();

    if (!address && !placeId) {
      return new Response(
        JSON.stringify({ success: false, error: "Address or place_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let url: string;
    if (placeId) {
      // Use Place Details API for place_id lookup
      url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(placeId)}&key=${apiKey}`;
    } else {
      // Use Geocoding API for address lookup, biased to UK
      url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=gb&key=${apiKey}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" || !data.results?.length) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data.status === "ZERO_RESULTS" 
            ? "No results found for this address" 
            : `Geocoding failed: ${data.status}` 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = data.results[0];
    const components = result.address_components as AddressComponent[];
    const geometry = result.geometry;

    // Extract address components
    const streetNumber = extractAddressComponent(components, "street_number");
    const route = extractAddressComponent(components, "route");
    const subpremise = extractAddressComponent(components, "subpremise");
    const premise = extractAddressComponent(components, "premise");
    const postalTown = extractAddressComponent(components, "postal_town");
    const locality = extractAddressComponent(components, "locality");
    const adminArea2 = extractAddressComponent(components, "administrative_area_level_2");
    const adminArea1 = extractAddressComponent(components, "administrative_area_level_1");
    const postcode = extractAddressComponent(components, "postal_code");
    const country = extractAddressComponent(components, "country") || "United Kingdom";

    // Build address line 1
    let addressLine1 = "";
    if (subpremise) addressLine1 += subpremise + ", ";
    if (premise) addressLine1 += premise + ", ";
    if (streetNumber) addressLine1 += streetNumber + " ";
    if (route) addressLine1 += route;
    addressLine1 = addressLine1.trim().replace(/,$/, "");

    // Address line 2 could be locality if different from town
    const addressLine2 = locality && locality !== postalTown ? locality : null;

    // Town/city is usually postal_town, fallback to locality
    const townCity = postalTown || locality || null;

    // County - use admin area 2 or 1
    const county = adminArea2 || adminArea1 || null;

    // Determine confidence based on geometry location_type
    let geocodeConfidence: 'exact' | 'approximate' | 'unknown' = 'unknown';
    if (geometry.location_type === "ROOFTOP") {
      geocodeConfidence = 'exact';
    } else if (geometry.location_type === "RANGE_INTERPOLATED" || geometry.location_type === "GEOMETRIC_CENTER") {
      geocodeConfidence = 'approximate';
    }

    const geocodeResult: GeocodeResult = {
      success: true,
      data: {
        place_id: result.place_id,
        formatted_address: result.formatted_address,
        latitude: geometry.location.lat,
        longitude: geometry.location.lng,
        address_line1: addressLine1 || result.formatted_address.split(",")[0],
        address_line2: addressLine2,
        town_city: townCity,
        county: county,
        postcode: postcode,
        country: country,
        geocode_confidence: geocodeConfidence,
      },
    };

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
