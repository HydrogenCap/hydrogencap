import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

import { withInvocationLog } from "../_shared/logger.ts";
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

const ALLOWED_FIELD_KEYS = new Set(Object.keys(FIELD_MAPPING).concat("epc_rating"));

interface PendingSuggestionRow {
  id: string;
  property_id: string;
  field_key: string;
  suggested_value: unknown;
  confidence: number;
  source_type: string;
  source_ref: string | null;
}

serve(withInvocationLog("apply-passport-suggestions", async (req, log) => {
  const corsHeaders = getCorsHeaders(req);
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

    const { data: property, error: propertyError } = await supabaseClient
      .from("properties")
      .select("id, org_id")
      .eq("id", property_id)
      .maybeSingle();

    if (propertyError || !property) {
      return new Response(JSON.stringify({ error: "Property not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await supabaseClient
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", property.org_id)
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const acceptedIds = Array.isArray(accepted_suggestions)
      ? accepted_suggestions
        .map((suggestion: { id?: unknown }) => suggestion?.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const rejectedIds = Array.isArray(rejected_suggestion_ids)
      ? rejected_suggestion_ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];
    const requestedSuggestionIds = Array.from(new Set([...acceptedIds, ...rejectedIds]));

    const pendingSuggestions = new Map<string, PendingSuggestionRow>();
    if (requestedSuggestionIds.length > 0) {
      const { data: suggestions, error: suggestionsError } = await supabaseClient
        .from("passport_autofill_suggestions")
        .select("id, property_id, field_key, suggested_value, confidence, source_type, source_ref")
        .eq("property_id", property_id)
        .eq("status", "pending")
        .in("id", requestedSuggestionIds);

      if (suggestionsError) {
        return new Response(JSON.stringify({ error: "Failed to validate suggestions" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      for (const suggestion of (suggestions || []) as PendingSuggestionRow[]) {
        pendingSuggestions.set(suggestion.id, suggestion);
      }

      const invalidSuggestionIds = requestedSuggestionIds.filter((id) => !pendingSuggestions.has(id));
      if (invalidSuggestionIds.length > 0) {
        return new Response(JSON.stringify({ error: "One or more suggestions are invalid for this property" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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

    if (acceptedIds.length > 0) {
      for (const acceptedId of acceptedIds) {
        const suggestion = pendingSuggestions.get(acceptedId);
        if (!suggestion) continue;
        const { id, field_key, suggested_value, source_type, source_ref, confidence } = suggestion;
        
        // Skip meta fields
        if (field_key === 'has_floorplan') continue;
        if (!ALLOWED_FIELD_KEYS.has(field_key)) {
          return new Response(JSON.stringify({ error: `Unsupported suggestion field: ${field_key}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        const dbField = FIELD_MAPPING[field_key] || field_key;
        const oldValue = existingPassport?.[dbField] ?? null;
        
        // Only update if value is not null/undefined
        if (suggested_value !== null && suggested_value !== undefined) {
          passportUpdates[dbField] = suggested_value;
          
          // Create audit entry
          auditEntries.push({
            property_id,
            field_key,
            old_value: oldValue,
            new_value: suggested_value,
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
    if (rejectedIds.length > 0) {
      for (const suggestionId of rejectedIds) {
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
        rejected_count: rejectedIds.length,
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
}));
