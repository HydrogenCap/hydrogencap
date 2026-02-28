import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://hydrogencap.com",
  "https://www.hydrogencap.com",
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

// Field mapping from suggestion field_key to passport table column
const FIELD_MAPPING: Record<string, string> = {
  local_authority: "local_authority_text",
  council_tax_band: "council_tax_band",
  construction_type: "construction_type",
  construction_date_band: "construction_date_band",
  bedrooms: "bedrooms",
  bathrooms: "bathrooms",
  ensuites: "ensuites",
  kitchens: "kitchens",
  living_rooms_communal: "living_rooms_communal",
  county: "county",
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

    const { property_id, accepted_suggestions, rejected_suggestion_ids } = await req.json();
    
    if (!property_id) {
      return new Response(JSON.stringify({ error: "property_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current passport data
    const { data: existingPassport } = await supabaseClient
      .from("property_passport")
      .select("*")
      .eq("property_id", property_id)
      .maybeSingle();

    // Process accepted suggestions
    const passportUpdates: Record<string, any> = {};
    const auditEntries: Array<{
      property_id: string;
      field_key: string;
      old_value: any;
      new_value: any;
      changed_by: string;
      change_reason: string;
      source_type: string;
      source_ref: string | null;
      confidence: number;
    }> = [];

    if (accepted_suggestions && Array.isArray(accepted_suggestions)) {
      for (const suggestion of accepted_suggestions) {
        const { id, field_key, value, source_type, source_ref, confidence } = suggestion;
        
        // Skip meta fields
        if (field_key === 'has_floorplan') continue;
        
        const dbField = FIELD_MAPPING[field_key] || field_key;
        const oldValue = existingPassport?.[dbField] ?? null;
        
        // Only update if value is not null/undefined
        if (value !== null && value !== undefined) {
          passportUpdates[dbField] = value;
          
          // Create audit entry
          auditEntries.push({
            property_id,
            field_key,
            old_value: oldValue,
            new_value: value,
            changed_by: user.id,
            change_reason: "ai_accept",
            source_type: source_type || "default",
            source_ref: source_ref || null,
            confidence: confidence || 0,
          });
        }

        // Mark suggestion as accepted
        if (id) {
          await supabaseClient
            .from("passport_autofill_suggestions")
            .update({
              status: "accepted",
              accepted_at: new Date().toISOString(),
              accepted_by: user.id,
            })
            .eq("id", id);
        }
      }
    }

    // Process rejected suggestions
    if (rejected_suggestion_ids && Array.isArray(rejected_suggestion_ids)) {
      for (const suggestionId of rejected_suggestion_ids) {
        await supabaseClient
          .from("passport_autofill_suggestions")
          .update({
            status: "rejected",
            rejected_at: new Date().toISOString(),
            rejected_by: user.id,
          })
          .eq("id", suggestionId);
      }
    }

    // Update passport if we have any updates
    let updatedPassport = existingPassport;
    if (Object.keys(passportUpdates).length > 0) {
      const { data, error: upsertError } = await supabaseClient
        .from("property_passport")
        .upsert({
          property_id,
          ...passportUpdates,
          updated_at: new Date().toISOString(),
        }, { onConflict: "property_id" })
        .select()
        .single();

      if (upsertError) {
        console.error("Passport update error:", upsertError);
        return new Response(JSON.stringify({ error: "Failed to update passport" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      updatedPassport = data;
    }

    // Insert audit entries
    if (auditEntries.length > 0) {
      const { error: auditError } = await supabaseClient
        .from("passport_field_audit")
        .insert(auditEntries);

      if (auditError) {
        console.error("Audit insert error:", auditError);
        // Don't fail the whole request for audit issues
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated_fields: Object.keys(passportUpdates).length,
        rejected_count: rejected_suggestion_ids?.length || 0,
        passport: updatedPassport,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in apply-passport-suggestions:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
