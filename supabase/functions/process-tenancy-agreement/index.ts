import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

import { withInvocationLog } from "../_shared/logger.ts";
interface ProcessTenancyRequest {
  fileUrl: string;
  tenantName: string;
  tenantType: "individual" | "company";
  propertyAddress: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse a Supabase Storage URL (or a bare `{org}/…` path) and return the
 * storage path IF it is well-formed and safe to hand to the admin client.
 *
 * Safety rules:
 *   - reject anything containing a `..` segment (path traversal, which HTTP
 *     URL normalisation would collapse when we build the download URL)
 *   - require the first segment to be a UUID (the org id). The caller then
 *     checks the auth user is a member of that org — without the UUID check
 *     an attacker could pass `anything/../{victim}/file` and split("/")[0]
 *     would be "anything" (which they are a member of), bypassing the
 *     membership check.
 */
function extractDocumentsStoragePath(fileUrl: string): string | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  if (!fileUrl) {
    return null;
  }

  let rawPath: string | null = null;

  if (!fileUrl.startsWith("http")) {
    rawPath = fileUrl;
  } else {
    if (!fileUrl.startsWith(supabaseUrl)) {
      return null;
    }

    try {
      const url = new URL(fileUrl);
      const path = url.pathname;
      const patterns = [
        "/storage/v1/object/sign/documents/",
        "/storage/v1/object/signed/documents/",
        "/storage/v1/object/public/documents/",
        "/storage/v1/object/documents/",
      ];

      for (const pattern of patterns) {
        const index = path.indexOf(pattern);
        if (index >= 0) {
          rawPath = decodeURIComponent(path.slice(index + pattern.length));
          break;
        }
      }
    } catch {
      return null;
    }
  }

  if (!rawPath) return null;

  // Strip any leading slashes, then reject absolute paths, traversal segments,
  // embedded nulls, or backslash tricks. Also reject empty segments.
  const cleaned = rawPath.replace(/^\/+/, "");
  if (!cleaned) return null;
  if (cleaned.includes("\\") || cleaned.includes("\0")) return null;
  const segments = cleaned.split("/");
  if (segments.some((s) => s === "" || s === "." || s === "..")) return null;

  // First segment MUST be the org UUID — this is what membership is checked on.
  if (!UUID_REGEX.test(segments[0])) return null;

  return cleaned;
}

async function fetchFileAsDataUrl(
  storagePath: string,
): Promise<{ dataUrl: string; mimeType: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const downloadUrl = `${supabaseUrl}/storage/v1/object/documents/${storagePath}`;
  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  });

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

serve(withInvocationLog("process-tenancy-agreement", async (req, log) => {
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

    // Rate limit check
    const rateLimit = await checkRateLimit(userData.user.id, 'process-tenancy-agreement', 15, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(corsHeaders, rateLimit.remaining, rateLimit.resetAt);
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

    const storagePath = extractDocumentsStoragePath(fileUrl);
    if (!storagePath) {
      return new Response(JSON.stringify({ error: "Only workspace document storage files are supported" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgPrefix = storagePath.split("/")[0];
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: memberships, error: membershipError } = await adminClient
      .from("memberships")
      .select("org_id")
      .eq("user_id", userData.user.id)
      .eq("org_id", orgPrefix);

    if (membershipError || !memberships || memberships.length === 0) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { dataUrl } = await fetchFileAsDataUrl(storagePath);

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
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-RateLimit-Remaining": String(rateLimit.remaining) },
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
}));
