import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

interface ProcessTenancyRequest {
  fileUrl: string;
  tenantName: string;
  tenantType: "individual" | "company";
  propertyAddress: string;
}

async function fetchFileAsDataUrl(
  fileUrl: string,
  authHeader: string
): Promise<{ dataUrl: string; mimeType: string }> {
  // For Supabase storage URLs, use the service role to download private files
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let response: Response;

  if (fileUrl.includes(supabaseUrl) && fileUrl.includes("/storage/")) {
    // Extract bucket and path from the URL
    // URL format: .../storage/v1/object/public|sign/bucket/path
    const storageMatch = fileUrl.match(/\/storage\/v1\/object\/(?:public|sign(?:ed)?)\/([^/]+)\/(.+)/);
    if (storageMatch) {
      const [, bucket, path] = storageMatch;
      const downloadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${decodeURIComponent(path)}`;
      response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      });
    } else {
      // Try fetching with the user's auth token as fallback
      response = await fetch(fileUrl, {
        headers: { Authorization: authHeader },
      });
    }
  } else {
    response = await fetch(fileUrl);
  }

  if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);
  const contentType = response.headers.get("content-type") || "application/pdf";
  const mimeType = contentType.split(";")[0].trim();
  return { dataUrl: `data:${mimeType};base64,${base64}`, mimeType };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user is actually authenticated
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const {
      fileUrl,
      tenantName,
      tenantType,
      propertyAddress,
    }: ProcessTenancyRequest = await req.json();

    console.log("Processing tenancy agreement for:", tenantName);

    const { dataUrl } = await fetchFileAsDataUrl(fileUrl, authHeader);

    const systemPrompt = `You are a UK property solicitor's assistant. Analyze this tenancy agreement PDF and extract the key terms.

The tenant is a ${tenantType === "company" ? "limited company" : "private individual"}.
Expected tenant name: ${tenantName}
Expected property address: ${propertyAddress || "Not specified"}

Extract ALL of the following information. If a field is not found in the document, return null for that field.

Respond with valid JSON only (no markdown, no code blocks):
{
  "document_type": "ast | company_let | licence_to_occupy | lodger_agreement | other",
  "tenant_name_on_agreement": "string",
  "tenant_name_matches": true/false,
  "landlord_name": "string or null",
  "property_address_on_agreement": "string",
  "property_address_matches": true/false,
  "room_or_unit": "string or null",
  "start_date": "YYYY-MM-DD or null",
  "end_date": "YYYY-MM-DD or null",
  "rent_amount_pcm": number or null,
  "rent_due_day": number or null,
  "deposit_amount": number or null,
  "deposit_scheme": "string or null",
  "notice_period_weeks": number or null,
  "break_clause_date": "YYYY-MM-DD or null",
  "break_clause_notice_months": number or null,
  "permitted_occupants": number or null,
  "includes_bills": true/false/null,
  "bills_included": "string or null",
  "furnished_status": "furnished | unfurnished | part_furnished | null",
  "pet_clause": "allowed | not_allowed | with_permission | null",
  "guarantor_required": true/false/null,
  "guarantor_name": "string or null",
  "special_conditions": ["array of notable special clauses as short strings"],
  "is_signed": true/false/null,
  "signature_date": "YYYY-MM-DD or null",
  "confidence": 0.0-1.0,
  "issues": [{"message": "string", "severity": "critical | warning | info"}]
}

IMPORTANT RULES:
- For rent_amount_pcm: extract the MONTHLY figure. If only weekly rent is given, multiply by 52/12. If only annual rent is given, divide by 12.
- For dates: use YYYY-MM-DD format. Convert UK date formats (DD/MM/YYYY) correctly.
- For deposit_scheme: look for references to DPS, TDS, mydeposits.
- Flag any unusual clauses in special_conditions.
- Flag in issues if the document appears unsigned, undated, or if tenant/property names don't match.`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
                  text: "Analyze this tenancy agreement and extract all key terms.",
                },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please top up your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices?.[0]?.message?.content || "";

    let extraction;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      extraction = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Parse error, raw:", responseText);
      extraction = {
        confidence: 0,
        issues: [
          { message: "Failed to parse document", severity: "critical" },
        ],
      };
    }

    console.log("Extraction complete, confidence:", extraction.confidence);

    return new Response(JSON.stringify({ success: true, extraction }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Process tenancy error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
