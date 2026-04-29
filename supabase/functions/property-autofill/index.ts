import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

import { withInvocationLog } from "../_shared/logger.ts";
/**
 * AI-powered property auto-fill.
 * Combines Postcodes.io + EPC Open Data + Lovable AI to infer property form fields.
 * Expects: { postcode, address_line_1 }
 * Returns: partial form fields to merge into the PropertyFormModal state.
 */

// ---------- Data source helpers ----------

async function fetchPostcodeData(postcode: string) {
  const clean = postcode.replace(/\s+/g, "").toUpperCase();
  const resp = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`);
  if (!resp.ok) return null;
  const json = await resp.json();
  if (json.status !== 200 || !json.result) return null;
  const r = json.result;
  return {
    county: (r.admin_county || r.region || "") as string,
    country: (r.country || "England") as string,
    council_name: (r.admin_district || "") as string,
    council_area: (r.parliamentary_constituency || "") as string,
    latitude: r.latitude as number | null,
    longitude: r.longitude as number | null,
  };
}

function normalizeAddress(addr: string): string {
  return addr.toLowerCase().replace(/[,.']/g, "").replace(/\s+/g, " ").trim();
}

function addressSimilarity(a: string, b: string): number {
  const t1 = new Set(normalizeAddress(a).split(" "));
  const t2 = new Set(normalizeAddress(b).split(" "));
  let m = 0;
  for (const t of t1) if (t2.has(t)) m++;
  return m / Math.max(t1.size, t2.size);
}

async function fetchEPCData(postcode: string, addressLine?: string) {
  try {
    const clean = postcode.replace(/\s+/g, "").toUpperCase();
    const url = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${encodeURIComponent(clean)}&size=50`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.rows?.length) return null;

    let best = data.rows[0];
    if (addressLine) {
      let bestScore = 0;
      for (const row of data.rows) {
        const score = addressSimilarity(addressLine, row.address || "");
        if (score > bestScore) { bestScore = score; best = row; }
      }
    }

    let builtYear: number | undefined;
    const ageBand = best["construction-age-band"];
    if (ageBand) {
      const m = ageBand.match(/(\d{4})/);
      if (m) builtYear = parseInt(m[1]);
    }

    return {
      epc_rating: best["current-energy-rating"] || null,
      property_type_raw: best["property-type"] || null,
      built_form: best["built-form"] || null,
      year_built: builtYear || null,
      construction_age_band: ageBand || null,
      floor_area: best["total-floor-area"] ? parseFloat(best["total-floor-area"]) : null,
      habitable_rooms: best["number-habitable-rooms"] ? parseInt(best["number-habitable-rooms"]) : null,
      tenure_raw: best.tenure || null,
      lodgement_date: best["lodgement-date"] || null,
    };
  } catch (e) {
    console.error("EPC fetch error:", e);
    return null;
  }
}

// ---------- AI inference ----------

async function inferWithAI(postcodeData: any, epcData: any, addressLine: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not set, skipping AI inference");
    return null;
  }

  const context = JSON.stringify({ postcode: postcodeData, epc: epcData, address: addressLine }, null, 2);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a UK property data expert. Given public register data about a property, infer the most likely values for form fields.
Return a JSON object with ONLY the fields you can confidently infer. Do not guess wildly.

Available property_type values: single_let, hmo_licensed, hmo_unlicensed, multi_let, commercial, mixed_use
Available lifecycle_stage values: pipeline, refurb, stabilised, exit
Available listing_grade values: none, grade_i, grade_ii_star, grade_ii
has_gas_supply: boolean (most UK houses built after 1950 with mains gas areas = true)
total_floors: integer
total_lettable_rooms: integer (habitable rooms from EPC minus communal areas, estimate for HMOs)

Rules:
- If EPC shows "House" with multiple habitable rooms (5+), likely HMO.
- If EPC shows "Flat", likely single_let.
- Listed buildings are rare; default to "none" unless address suggests heritage area.
- lifecycle_stage: if property has current EPC, likely "stabilised".
- Only include fields where you have reasonable confidence (>70%).`,
          },
          {
            role: "user",
            content: `Property data:\n${context}\n\nReturn ONLY a valid JSON object with inferred fields.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "set_property_fields",
              description: "Set inferred property form fields",
              parameters: {
                type: "object",
                properties: {
                  property_type: { type: "string", enum: ["single_let", "hmo_licensed", "hmo_unlicensed", "multi_let", "commercial", "mixed_use"] },
                  lifecycle_stage: { type: "string", enum: ["pipeline", "refurb", "stabilised", "exit"] },
                  listing_grade: { type: "string", enum: ["none", "grade_i", "grade_ii_star", "grade_ii"] },
                  has_gas_supply: { type: "boolean" },
                  total_floors: { type: "integer" },
                  total_lettable_rooms: { type: "integer" },
                  year_built: { type: "integer" },
                },
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "set_property_fields" } },
      }),
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      if (resp.status === 429) {
        console.warn("AI rate limited");
        return null;
      }
      if (resp.status === 402) {
        console.warn("AI credits exhausted");
        return null;
      }
      console.error("AI gateway error:", resp.status, await resp.text());
      return null;
    }

    const result = await resp.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        return JSON.parse(toolCall.function.arguments);
      } catch {
        console.error("Failed to parse AI tool call arguments");
        return null;
      }
    }
    return null;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      console.warn("AI inference timed out after 15s");
    } else {
      console.error("AI inference error:", e);
    }
    return null;
  }
}

// ---------- Main handler ----------

serve(withInvocationLog("property-autofill", async (req, _invocationLog) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u, error: ae } = await supabase.auth.getUser();
    if (ae || !u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit check
    const rateLimit = await checkRateLimit(u.user.id, 'property-autofill', 20, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(corsHeaders, rateLimit.remaining, rateLimit.resetAt);
    }

    const { postcode, address_line_1 } = await req.json();
    if (!postcode) {
      return new Response(JSON.stringify({ error: "postcode is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Property autofill for:", postcode, address_line_1);

    // Fetch public data in parallel
    const [postcodeData, epcData] = await Promise.all([
      fetchPostcodeData(postcode),
      fetchEPCData(postcode, address_line_1),
    ]);

    // Start with deterministic fields from Postcodes.io
    const fields: Record<string, any> = {};
    const sources: Record<string, string> = {};

    if (postcodeData) {
      if (postcodeData.county) { fields.county = postcodeData.county; sources.county = "Postcodes.io"; }
      if (postcodeData.country) { fields.country = postcodeData.country; sources.country = "Postcodes.io"; }
      if (postcodeData.council_name) { fields.council_name = postcodeData.council_name; sources.council_name = "Postcodes.io"; }
      if (postcodeData.council_area) { fields.council_area = postcodeData.council_area; sources.council_area = "Postcodes.io"; }
    }

    // Add EPC data
    if (epcData) {
      if (epcData.year_built) { fields.year_built = String(epcData.year_built); sources.year_built = "EPC Register"; }
      if (epcData.habitable_rooms) { fields.total_lettable_rooms = String(epcData.habitable_rooms); sources.total_lettable_rooms = "EPC Register"; }
    }

    // AI inference for remaining fields
    const aiFields = await inferWithAI(postcodeData, epcData, address_line_1 || "");
    if (aiFields) {
      for (const [key, value] of Object.entries(aiFields)) {
        if (value !== null && value !== undefined && !(key in fields)) {
          fields[key] = typeof value === "number" ? String(value) : value;
          sources[key] = "AI";
        }
      }
    }

    console.log("Autofill result:", { fields, sources });

    return new Response(
      JSON.stringify({ fields, sources, epc_data: epcData, postcode_data: postcodeData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Property autofill error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
