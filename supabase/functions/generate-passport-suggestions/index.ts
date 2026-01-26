import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Field configuration for passport suggestions
const MUST_CONFIRM_FIELDS = ['local_authority', 'council_tax_band', 'construction_type'];

// Construction type mapping from EPC descriptions
const CONSTRUCTION_TYPE_MAP: Record<string, string> = {
  'solid brick': 'Solid Brick',
  'cavity brick': 'Cavity Brick',
  'timber frame': 'Timber Frame',
  'stone': 'Stone',
  'concrete': 'Concrete/System Build',
  'system build': 'Concrete/System Build',
  'prefab': 'Concrete/System Build',
};

// Construction date band mapping from EPC
const DATE_BAND_MAP: Record<string, string> = {
  'before 1900': 'Pre-1900',
  '1900-1929': '1900-1929',
  '1930-1949': '1930-1949',
  '1950-1966': '1950-1966',
  '1967-1975': '1967-1979',
  '1976-1982': '1967-1979',
  '1983-1990': '1980-1990',
  '1991-1995': '1991-2002',
  '1996-2002': '1991-2002',
  '2003-2006': '2003+',
  '2007-2011': '2003+',
  '2012 onwards': '2003+',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { property_id } = await req.json();
    if (!property_id) {
      return new Response(JSON.stringify({ error: "property_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Load property data
    const { data: property, error: propError } = await supabaseClient
      .from("properties")
      .select("*, property_passport(*)")
      .eq("id", property_id)
      .single();

    if (propError || !property) {
      return new Response(JSON.stringify({ error: "Property not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const suggestions: Array<{
      field_key: string;
      suggested_value: any;
      confidence: number;
      source_type: string;
      source_ref: string | null;
      evidence_excerpt: string | null;
    }> = [];

    // 2) Postcode lookup for Local Authority
    if (property.postcode) {
      try {
        const postcodeResp = await fetch(
          `https://api.postcodes.io/postcodes/${encodeURIComponent(property.postcode.replace(/\s/g, ''))}`
        );
        if (postcodeResp.ok) {
          const postcodeData = await postcodeResp.json();
          if (postcodeData.result?.admin_district) {
            suggestions.push({
              field_key: "local_authority",
              suggested_value: postcodeData.result.admin_district,
              confidence: 0.95,
              source_type: "postcode_lookup",
              source_ref: property.postcode,
              evidence_excerpt: `Postcode ${property.postcode} maps to ${postcodeData.result.admin_district}`,
            });
          }

          // Also get region/county if available
          if (postcodeData.result?.region) {
            suggestions.push({
              field_key: "county",
              suggested_value: postcodeData.result.region,
              confidence: 0.9,
              source_type: "postcode_lookup",
              source_ref: property.postcode,
              evidence_excerpt: `Region: ${postcodeData.result.region}`,
            });
          }
        }
      } catch (e) {
        console.error("Postcode lookup failed:", e);
      }
    }

    // 3) Load EPC documents and extract data
    const { data: epcDocs } = await supabaseClient
      .from("documents")
      .select("*")
      .eq("property_id", property_id)
      .eq("doc_type", "EPC");

    if (epcDocs && epcDocs.length > 0) {
      const latestEpc = epcDocs[0];
      
      // If EPC has extracted data, use it
      if (latestEpc.extracted_epc_rating) {
        suggestions.push({
          field_key: "epc_rating",
          suggested_value: latestEpc.extracted_epc_rating,
          confidence: 0.9,
          source_type: "epc",
          source_ref: latestEpc.id,
          evidence_excerpt: `EPC Rating: ${latestEpc.extracted_epc_rating}`,
        });
      }

      // For construction data, use AI extraction if available
      // Check existing property data that may have come from EPC
      if (property.epc_rating && !suggestions.find(s => s.field_key === 'epc_rating')) {
        suggestions.push({
          field_key: "epc_rating",
          suggested_value: property.epc_rating,
          confidence: 0.85,
          source_type: "epc",
          source_ref: null,
          evidence_excerpt: `Existing EPC rating from property record`,
        });
      }
    }

    // 4) Council Tax Band - attempt AI extraction from documents
    const { data: allDocs } = await supabaseClient
      .from("documents")
      .select("*")
      .eq("property_id", property_id);

    // If we have documents, try AI extraction for council tax
    if (allDocs && allDocs.length > 0) {
      // Use Lovable AI for extraction
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const docSummary = allDocs
          .map(d => `${d.doc_type || 'Unknown'}: ${d.original_file_name}${d.extracted_address_text ? ` - ${d.extracted_address_text}` : ''}`)
          .join('\n');

        try {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content: `You are a property data extraction assistant. Extract property details from document information. 
                  Return ONLY a JSON object with these fields (use null for unknown):
                  {
                    "council_tax_band": "A-H or null",
                    "construction_type": "Solid Brick|Cavity Brick|Timber Frame|Stone|Concrete/System Build or null",
                    "construction_date_band": "Pre-1900|1900-1929|1930-1949|1950-1966|1967-1979|1980-1990|1991-2002|2003+ or null",
                    "bedrooms": number or null,
                    "bathrooms": number or null
                  }`
                },
                {
                  role: "user",
                  content: `Property: ${property.address_line}, ${property.postcode}
                  
Documents available:
${docSummary}

Based on typical UK property patterns and any available information, suggest values for the property passport.`
                }
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content || "";
            
            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const extracted = JSON.parse(jsonMatch[0]);
              
              if (extracted.council_tax_band) {
                suggestions.push({
                  field_key: "council_tax_band",
                  suggested_value: extracted.council_tax_band,
                  confidence: 0.5,
                  source_type: "default",
                  source_ref: null,
                  evidence_excerpt: "AI estimation based on document analysis",
                });
              }
              
              if (extracted.construction_type) {
                suggestions.push({
                  field_key: "construction_type",
                  suggested_value: extracted.construction_type,
                  confidence: 0.6,
                  source_type: "default",
                  source_ref: null,
                  evidence_excerpt: "AI estimation based on property characteristics",
                });
              }
              
              if (extracted.construction_date_band) {
                suggestions.push({
                  field_key: "construction_date_band",
                  suggested_value: extracted.construction_date_band,
                  confidence: 0.5,
                  source_type: "default",
                  source_ref: null,
                  evidence_excerpt: "AI estimation based on address/area patterns",
                });
              }

              if (extracted.bedrooms && !property.property_passport?.[0]?.bedrooms) {
                suggestions.push({
                  field_key: "bedrooms",
                  suggested_value: extracted.bedrooms,
                  confidence: 0.6,
                  source_type: "listing",
                  source_ref: null,
                  evidence_excerpt: "Estimated from property type and documents",
                });
              }
            }
          }
        } catch (e) {
          console.error("AI extraction failed:", e);
        }
      }
    }

    // 5) Check floorplans for room counts
    const { data: floorplans } = await supabaseClient
      .from("floorplans")
      .select("*")
      .eq("property_id", property_id);

    if (floorplans && floorplans.length > 0) {
      // Mark that we have floorplans available for potential extraction
      suggestions.push({
        field_key: "has_floorplan",
        suggested_value: true,
        confidence: 1.0,
        source_type: "floorplan",
        source_ref: floorplans[0].id,
        evidence_excerpt: `${floorplans.length} floorplan(s) available`,
      });
    }

    // 6) Default suggestions for must-confirm fields if not already suggested
    if (!suggestions.find(s => s.field_key === 'local_authority')) {
      suggestions.push({
        field_key: "local_authority",
        suggested_value: null,
        confidence: 0,
        source_type: "default",
        source_ref: null,
        evidence_excerpt: "No data found - manual entry required",
      });
    }

    if (!suggestions.find(s => s.field_key === 'council_tax_band')) {
      suggestions.push({
        field_key: "council_tax_band",
        suggested_value: null,
        confidence: 0,
        source_type: "default",
        source_ref: null,
        evidence_excerpt: "No data found - manual entry required",
      });
    }

    if (!suggestions.find(s => s.field_key === 'construction_type')) {
      suggestions.push({
        field_key: "construction_type",
        suggested_value: null,
        confidence: 0,
        source_type: "default",
        source_ref: null,
        evidence_excerpt: "No data found - manual entry required",
      });
    }

    // 7) Clear old pending suggestions and insert new ones
    await supabaseClient
      .from("passport_autofill_suggestions")
      .delete()
      .eq("property_id", property_id)
      .eq("status", "pending");

    // Filter out suggestions with null values (DB has NOT NULL constraint)
    const validSuggestions = suggestions.filter(s => s.suggested_value !== null);

    // Insert new suggestions (only those with actual values)
    const { data: insertedSuggestions, error: insertError } = await supabaseClient
      .from("passport_autofill_suggestions")
      .insert(
        validSuggestions.map(s => ({
          property_id,
          field_key: s.field_key,
          suggested_value: s.suggested_value,
          confidence: s.confidence,
          source_type: s.source_type,
          source_ref: s.source_ref,
          evidence_excerpt: s.evidence_excerpt,
          status: "pending",
        }))
      )
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save suggestions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        suggestions: insertedSuggestions,
        must_confirm_fields: MUST_CONFIRM_FIELDS,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-passport-suggestions:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
