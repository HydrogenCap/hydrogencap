import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getAdminClient, type AdminSupabaseClient } from "../_shared/admin-client.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { requireActiveSubscription } from "../_shared/checkSubscription.ts";

import { withInvocationLog } from "../_shared/logger.ts";
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

async function fetchFileAsDataUrl(fileUrl: string): Promise<{ dataUrl: string; mimeType: string }> {
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);
  const contentType = response.headers.get("content-type") || "";
  let mimeType = contentType.split(";")[0].trim();
  if (!mimeType || mimeType === "application/octet-stream") {
    const ext = fileUrl.split(".").pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    };
    mimeType = mimeMap[ext || ""] || "application/octet-stream";
  }
  return { dataUrl: `data:${mimeType};base64,${base64}`, mimeType };
}

function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

serve(withInvocationLog("summarize-valuation-document", async (req, _invocationLog) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Tracked so the catch-all can mark the summaries row as failed if anything
  // between the initial upsert and the successful completion throws — otherwise
  // the row is stuck in "processing" forever (same bug class as the original
  // documents-stuck-in-pending issue).
  let summaryId: string | null = null;
  let adminSupabase: AdminSupabaseClient | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: authError } = await userSupabase.auth.getUser();
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Subscription check
    const subCheck = await requireActiveSubscription(userData.user.id, corsHeaders);
    if (!subCheck.allowed) return subCheck.response;

    // Rate limit check
    const rateLimit = await checkRateLimit(userData.user.id, 'summarize-valuation-document', 15, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(corsHeaders, rateLimit.remaining, rateLimit.resetAt);
    }

    const { documentId } = await req.json();
    if (!documentId) {
      return new Response(JSON.stringify({ error: "documentId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify access
    const { data: doc, error: docError } = await userSupabase
      .from("documents")
      .select("id, org_id, file_url, property_id, category")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getAdminClient();
    adminSupabase = supabase;

    // Upsert processing record
    const { data: summary, error: upsertError } = await supabase
      .from("document_summaries")
      .upsert(
        {
          document_id: documentId,
          org_id: doc.org_id,
          summary_type: "valuation",
          status: "processing",
          property_id: doc.property_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_id,summary_type" }
      )
      .select("id")
      .single();

    if (upsertError) throw upsertError;
    summaryId = summary.id;

    // Fetch properties for matching
    const { data: properties } = await supabase
      .from("properties")
      .select("id, address_line, postcode")
      .eq("org_id", doc.org_id);

    const propertyList = (properties || [])
      .map((p: any, i: number) => `${i + 1}. ID: ${p.id} — ${p.address_line}, ${p.postcode || ""}`)
      .join("\n");

    // Fetch and convert file
    console.log(`Fetching file for document ${documentId}`);
    const { dataUrl } = await fetchFileAsDataUrl(doc.file_url);

    const prompt = `You are a UK property valuation document analyst. Analyse this valuation report or surveyor report and extract all key information.

PROPERTIES IN PORTFOLIO (match the subject property to one if possible):
${propertyList || "No properties registered"}

Extract the following. Respond with valid JSON only — no markdown, no code fences:

{
  "valuation_figure_gbp": number or null,
  "valuation_date": "YYYY-MM-DD" or null,
  "surveyor_name": "string" or null,
  "surveyor_firm": "string" or null,
  "surveyor_rics_number": "string" or null,
  "valuation_basis": "Market Value" or "Insurance Reinstatement" or "Fair Value" or null,
  "tenure": "Freehold" or "Leasehold" or "Share of Freehold" or null,
  "property_type_noted": "string" or null,
  "condition_rating": "Good" or "Fair" or "Poor" or "Very Poor" or null,
  "condition_notes": "brief summary" or null,
  "key_observations": ["max 6 important points from the report"],
  "special_assumptions": ["any special assumptions made"],
  "comparable_evidence": [{"address":"...","price":0,"date":"YYYY-MM-DD","notes":"..."}],
  "risk_factors": ["flagged risks"],
  "recommended_actions": ["surveyor recommendations"],
  "gross_internal_area_sqft": number or null,
  "price_per_sqft": number or null,
  "matched_property_id": "UUID from list above or null",
  "executive_summary": "2-3 sentence investor-friendly summary of this valuation",
  "confidence": 0.0 to 1.0
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a UK property valuation document analyst. Always respond with valid JSON only." },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);
      await supabase.from("document_summaries").update({ status: "failed" }).eq("id", summary.id);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: `AI error: ${aiResponse.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices?.[0]?.message?.content || "";

    let extracted: any;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      extracted = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("Parse error:", parseErr, "Response:", responseText.substring(0, 500));
      await supabase.from("document_summaries").update({ status: "failed" }).eq("id", summary.id);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validPropertyId = isValidUUID(extracted.matched_property_id)
      ? extracted.matched_property_id
      : doc.property_id || null;

    const { error: updateError } = await supabase
      .from("document_summaries")
      .update({
        status: "completed",
        valuation_figure_gbp: extracted.valuation_figure_gbp,
        valuation_date: extracted.valuation_date,
        surveyor_name: extracted.surveyor_name,
        surveyor_firm: extracted.surveyor_firm,
        surveyor_rics_number: extracted.surveyor_rics_number,
        valuation_basis: extracted.valuation_basis,
        tenure: extracted.tenure,
        property_type_noted: extracted.property_type_noted,
        condition_rating: extracted.condition_rating,
        condition_notes: extracted.condition_notes,
        key_observations: extracted.key_observations || [],
        special_assumptions: extracted.special_assumptions || [],
        comparable_evidence: extracted.comparable_evidence || [],
        risk_factors: extracted.risk_factors || [],
        recommended_actions: extracted.recommended_actions || [],
        gross_internal_area_sqft: extracted.gross_internal_area_sqft,
        price_per_sqft: extracted.price_per_sqft,
        executive_summary: extracted.executive_summary,
        ai_model: "gemini-2.5-flash",
        ai_confidence: extracted.confidence,
        raw_extraction: extracted,
        property_id: validPropertyId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", summary.id);

    if (updateError) {
      console.error("Save error:", updateError);
      throw updateError;
    }

    // Auto-link document to property if not already linked
    if (validPropertyId && !doc.property_id) {
      await supabase.from("documents").update({ property_id: validPropertyId }).eq("id", documentId);
    }

    console.log(`Summary completed for ${documentId}: £${extracted.valuation_figure_gbp}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary_id: summary.id,
        valuation_figure: extracted.valuation_figure_gbp,
        executive_summary: extracted.executive_summary,
        property_id: validPropertyId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json", "X-RateLimit-Remaining": String(rateLimit.remaining) } }
    );
  } catch (error: any) {
    console.error("summarize-valuation-document error:", error);
    // Catch-all: if we created a processing row, make sure it's marked failed
    // so the UI stops spinning. Best-effort — swallow any secondary error here.
    if (summaryId && adminSupabase) {
      try {
        await adminSupabase
          .from("document_summaries")
          .update({
            status: "failed",
            error_message: (error?.message ?? "Unknown error").slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", summaryId);
      } catch (resetErr) {
        console.error("Failed to reset summary status:", resetErr);
      }
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
