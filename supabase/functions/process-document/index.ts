import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Document types we can classify
const DOC_TYPES = [
  "epc_certificate",
  "gas_safety_certificate",
  "electrical_certificate",
  "insurance_policy",
  "tenancy_agreement",
  "mortgage_offer",
  "valuation_report",
  "inventory",
  "rent_statement",
  "service_charge",
  "ground_rent",
  "council_tax",
  "utility_bill",
  "asbestos_management_survey",
  "asbestos_rd_survey",
  "other",
] as const;

interface ProcessDocumentRequest {
  documentId: string;
  fileUrl: string;
  properties: { id: string; address_line: string; postcode: string | null }[];
}

interface AIExtractionResult {
  doc_type: string;
  doc_type_confidence: number;
  matched_property_id: string | null;
  property_confidence: number;
  extracted_address: string | null;
  extracted_expiry_date: string | null;
  extracted_issue_date: string | null;
  extracted_reference_number: string | null;
  extracted_epc_rating: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create client with user's JWT for RLS-protected access
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getUser();
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { documentId, fileUrl, properties }: ProcessDocumentRequest = await req.json();

    console.log(`Processing document ${documentId} for user ${claimsData.user.id}`);

    // Verify user has access to this document via RLS
    const { data: docAccess, error: accessError } = await userSupabase
      .from("documents")
      .select("id, org_id")
      .eq("id", documentId)
      .single();

    if (accessError || !docAccess) {
      return new Response(
        JSON.stringify({ error: 'Access denied to document' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for updates (after access verified)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update status to processing
    await supabase
      .from("documents")
      .update({ extraction_status: "processing" })
      .eq("id", documentId);

    // Build the prompt for Gemini
    const propertyList = properties
      .map((p, i) => `${i + 1}. ID: ${p.id}, Address: ${p.address_line}, Postcode: ${p.postcode || "N/A"}`)
      .join("\n");

    const systemPrompt = `You are a document analysis AI for UK property management. Analyze the provided document image and extract information.

Your task:
1. Classify the document type from this list: ${DOC_TYPES.join(", ")}
2. Extract any property address mentioned in the document
3. Match the address to one of the user's properties if possible
4. Extract key dates (expiry date, issue date) if present
5. Extract any reference numbers
6. For EPC certificates, extract the energy rating (A-G)

User's properties:
${propertyList || "No properties registered yet"}

Respond with a JSON object using this exact schema (no markdown, just valid JSON):
{
  "doc_type": "string - one of the document types listed above",
  "doc_type_confidence": "number 0-1 - how confident you are in the classification",
  "matched_property_id": "string or null - the ID of the matched property from the list, or null if no match",
  "property_confidence": "number 0-1 - how confident you are in the property match",
  "extracted_address": "string or null - the address found in the document",
  "extracted_expiry_date": "string or null - ISO date format YYYY-MM-DD if found",
  "extracted_issue_date": "string or null - ISO date format YYYY-MM-DD if found",
  "extracted_reference_number": "string or null - any certificate/reference number found",
  "extracted_epc_rating": "string or null - EPC rating A-G if this is an EPC certificate"
}`;

    // Call Lovable AI Gateway with Gemini for vision
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please analyze this document and extract the required information.",
              },
              {
                type: "image_url",
                image_url: { url: fileUrl },
              },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        await supabase
          .from("documents")
          .update({ extraction_status: "rate_limited" })
          .eq("id", documentId);
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        await supabase
          .from("documents")
          .update({ extraction_status: "credits_exhausted" })
          .eq("id", documentId);
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices?.[0]?.message?.content || "";
    
    console.log("AI response:", responseText);

    // Parse the JSON response
    let extraction: AIExtractionResult;
    try {
      // Try to extract JSON from the response (may have markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      extraction = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      extraction = {
        doc_type: "other",
        doc_type_confidence: 0.5,
        matched_property_id: null,
        property_confidence: 0,
        extracted_address: null,
        extracted_expiry_date: null,
        extracted_issue_date: null,
        extracted_reference_number: null,
        extracted_epc_rating: null,
      };
    }

    // Update the document with AI suggestions
    const updateData: Record<string, unknown> = {
      extraction_status: "completed",
      ai_suggested_doc_type: extraction.doc_type,
      ai_doc_type_confidence: extraction.doc_type_confidence,
      ai_suggested_property_id: extraction.matched_property_id,
      ai_property_confidence: extraction.property_confidence,
      extracted_address_text: extraction.extracted_address,
      extracted_reference_number: extraction.extracted_reference_number,
      extracted_epc_rating: extraction.extracted_epc_rating,
    };

    // Parse and set dates if valid
    if (extraction.extracted_expiry_date) {
      const expiryDate = new Date(extraction.extracted_expiry_date);
      if (!isNaN(expiryDate.getTime())) {
        updateData.expiry_date = extraction.extracted_expiry_date;
      }
    }

    if (extraction.extracted_issue_date) {
      const issueDate = new Date(extraction.extracted_issue_date);
      if (!isNaN(issueDate.getTime())) {
        updateData.extracted_issue_date = extraction.extracted_issue_date;
      }
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update(updateData)
      .eq("id", documentId);

    if (updateError) {
      console.error("Failed to update document:", updateError);
      throw updateError;
    }

    console.log(`Document ${documentId} processed successfully`);

    return new Response(
      JSON.stringify({ success: true, extraction }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Process document error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
