import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Compliance document types - aligned with UK property compliance requirements
const COMPLIANCE_DOC_TYPES = [
  "gas_safety_certificate",      // CP12
  "electrical_certificate",      // EICR
  "epc_certificate",             // EPC
  "fire_alarm_certificate",
  "emergency_lighting_certificate",
  "fire_suppression_certificate", // Fire suppression system inspection
  "pat_testing",
  "fire_risk_assessment",
  "hmo_licence",
  "building_insurance",
  "public_liability_insurance",
  "asbestos_survey",
  "legionella_assessment",
  "planning_building_control",
  "other",
] as const;

// Map doc types to compliance_items compliance_type
const DOC_TYPE_TO_COMPLIANCE_TYPE: Record<string, string> = {
  "gas_safety_certificate": "Gas Safety Certificate (CP12)",
  "electrical_certificate": "Electrical Safety Certificate (EICR)",
  "epc_certificate": "EPC",
  "fire_alarm_certificate": "Fire Alarm Certificate",
  "emergency_lighting_certificate": "Emergency Lighting Certificate",
  "fire_suppression_certificate": "Fire Suppression System Certificate",
  "pat_testing": "PAT Testing",
  "fire_risk_assessment": "Fire Risk Assessment (FRA)",
  "hmo_licence": "HMO Licence",
  "building_insurance": "Insurance Schedule",
  "public_liability_insurance": "Insurance Schedule",
  "asbestos_survey": "Asbestos Survey",
  "legionella_assessment": "Legionella Risk Assessment",
  "planning_building_control": "Building Control Certificate",
};

interface ProcessDocumentRequest {
  documentId: string;
  fileUrl: string;
  properties: { id: string; address_line: string; postcode: string | null; title_number?: string | null }[];
}

interface AIExtractionResult {
  doc_type: string;
  doc_type_confidence: number;
  matched_property_id: string | null;
  property_confidence: number;
  extracted_address: string | null;
  extracted_postcode: string | null;
  extracted_title_number: string | null;
  extracted_expiry_date: string | null;
  extracted_issue_date: string | null;
  extracted_reference_number: string | null;
  extracted_epc_rating: string | null;
  extracted_certifier_name: string | null;
  extracted_certifier_company: string | null;
  compliance_type: string | null;
}

// Helper to validate UUID format
function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Helper to convert file to base64 data URL
async function fetchFileAsDataUrl(fileUrl: string): Promise<{ dataUrl: string; mimeType: string }> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Convert to base64
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);
  
  // Determine MIME type from URL or content-type header
  const contentType = response.headers.get('content-type') || '';
  let mimeType = contentType.split(';')[0].trim();
  
  // Fallback: detect from URL extension
  if (!mimeType || mimeType === 'application/octet-stream') {
    const ext = fileUrl.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
    };
    mimeType = mimeMap[ext || ''] || 'application/octet-stream';
  }
  
  return {
    dataUrl: `data:${mimeType};base64,${base64}`,
    mimeType,
  };
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

    console.log(`Processing compliance document ${documentId} for user ${claimsData.user.id}`);

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

    // Fetch the file and convert to base64 data URL for AI processing
    console.log(`Fetching file from: ${fileUrl}`);
    const { dataUrl, mimeType } = await fetchFileAsDataUrl(fileUrl);
    console.log(`File converted to data URL, MIME type: ${mimeType}`);

    // Build the prompt for Gemini - optimized for UK compliance documents
    const propertyList = properties
      .map((p, i) => `${i + 1}. ID: ${p.id}, Address: ${p.address_line}, Postcode: ${p.postcode || "N/A"}${p.title_number ? `, Title: ${p.title_number}` : ""}`)
      .join("\n");

    const systemPrompt = `You are a UK property compliance document specialist. Analyze this document to classify and extract compliance information.

COMPLIANCE DOCUMENT TYPES (choose the most specific match):
${COMPLIANCE_DOC_TYPES.map(t => `- ${t}`).join("\n")}

PROPERTY MATCHING:
Match to properties using address, postcode, or title number:
${propertyList || "No properties registered"}

EXTRACTION REQUIREMENTS:
1. Document type - classify into compliance categories above
2. Property address - full address as written on document
3. Postcode - UK postcode format
4. Title number - if present (Land Registry reference)
5. Issue date - when certificate was issued
6. Expiry/renewal date - when certificate expires (critical for compliance)
7. Reference/certificate number
8. Certifier name - engineer/inspector who signed
9. Certifier company - company name of certifier
10. For EPC only: energy rating A-G

Respond with valid JSON only (no markdown):
{
  "doc_type": "one of: ${COMPLIANCE_DOC_TYPES.join(", ")}",
  "doc_type_confidence": 0.0-1.0,
  "matched_property_id": "UUID or null",
  "property_confidence": 0.0-1.0,
  "extracted_address": "string or null",
  "extracted_postcode": "string or null - UK format",
  "extracted_title_number": "string or null",
  "extracted_expiry_date": "YYYY-MM-DD or null",
  "extracted_issue_date": "YYYY-MM-DD or null",
  "extracted_reference_number": "string or null",
  "extracted_epc_rating": "A-G or null",
  "extracted_certifier_name": "string or null",
  "extracted_certifier_company": "string or null"
}`;

    // Call Lovable AI Gateway with Gemini for vision - use data URL for PDF/image support
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
                text: "Analyze this compliance document and extract all required information for property compliance tracking.",
              },
              {
                type: "image_url",
                image_url: { url: dataUrl },
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
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Map to compliance type
      const complianceType = DOC_TYPE_TO_COMPLIANCE_TYPE[parsed.doc_type] || null;
      
      // Validate UUID - AI sometimes returns truncated UUIDs
      const validPropertyId = isValidUUID(parsed.matched_property_id) 
        ? parsed.matched_property_id 
        : null;
      
      if (parsed.matched_property_id && !validPropertyId) {
        console.warn(`AI returned invalid UUID: ${parsed.matched_property_id}, setting to null`);
      }
      
      extraction = {
        ...parsed,
        matched_property_id: validPropertyId,
        compliance_type: complianceType,
      };
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      extraction = {
        doc_type: "other",
        doc_type_confidence: 0.5,
        matched_property_id: null,
        property_confidence: 0,
        extracted_address: null,
        extracted_postcode: null,
        extracted_title_number: null,
        extracted_expiry_date: null,
        extracted_issue_date: null,
        extracted_reference_number: null,
        extracted_epc_rating: null,
        extracted_certifier_name: null,
        extracted_certifier_company: null,
        compliance_type: null,
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

    console.log(`Compliance document ${documentId} processed successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        extraction,
        compliance_type: extraction.compliance_type,
      }),
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