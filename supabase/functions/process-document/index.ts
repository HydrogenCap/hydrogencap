import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Compliance document types
const COMPLIANCE_DOC_TYPES = [
  "gas_safety_certificate", "electrical_certificate", "epc_certificate",
  "fire_alarm_certificate", "emergency_lighting_certificate", "fire_suppression_certificate",
  "pat_testing", "fire_risk_assessment", "hmo_licence",
  "building_insurance", "public_liability_insurance", "asbestos_survey",
  "legionella_assessment", "planning_building_control", "fire_door_certification",
  "fire_panel_commissioning", "mcs_certificate", "floor_plans", "other",
] as const;

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
  "building_insurance": "Buildings Insurance Schedule",
  "public_liability_insurance": "Insurance Schedule",
  "asbestos_survey": "Asbestos Survey",
  "legionella_assessment": "Legionella Risk Assessment",
  "planning_building_control": "Building Control Certificate",
  "fire_door_certification": "Fire Door Certification",
  "fire_panel_commissioning": "Fire Panel Commissioning Certificate",
  "mcs_certificate": "MCS Certificate",
};

const DEFAULT_VALIDITY_YEARS: Record<string, number> = {
  "gas_safety_certificate": 1, "electrical_certificate": 5, "epc_certificate": 10,
  "fire_alarm_certificate": 1, "emergency_lighting_certificate": 1,
  "fire_suppression_certificate": 1, "pat_testing": 1, "fire_risk_assessment": 1,
  "hmo_licence": 5, "legionella_assessment": 2,
};

const DEFAULT_REMINDER_DAYS = [90, 60, 30, 14, 7];

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

function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

async function fetchFileAsDataUrl(fileUrl: string): Promise<{ dataUrl: string; mimeType: string }> {
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);
  const contentType = response.headers.get('content-type') || '';
  let mimeType = contentType.split(';')[0].trim();
  if (!mimeType || mimeType === 'application/octet-stream') {
    const ext = fileUrl.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      'pdf': 'application/pdf', 'png': 'image/png', 'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg', 'gif': 'image/gif', 'webp': 'image/webp',
    };
    mimeType = mimeMap[ext || ''] || 'application/octet-stream';
  }
  return { dataUrl: `data:${mimeType};base64,${base64}`, mimeType };
}

function calculateExpiryDate(docType: string, issueDate: string | null, providedExpiry: string | null): string | null {
  if (providedExpiry) return providedExpiry;
  if (!issueDate) return null;
  const validityYears = DEFAULT_VALIDITY_YEARS[docType];
  if (!validityYears) return null;
  const issue = new Date(issueDate);
  issue.setFullYear(issue.getFullYear() + validityYears);
  return issue.toISOString().split('T')[0];
}

function generateComplianceFilename(complianceType: string, propertyAddress: string, originalFilename: string): string {
  const typeCodes: Record<string, string> = {
    'Gas Safety Certificate (CP12)': 'GasSafety', 'Electrical Safety Certificate (EICR)': 'EICR',
    'Fire Alarm Certificate': 'FireAlarm', 'Emergency Lighting Certificate': 'EmergencyLighting',
    'Fire Risk Assessment (FRA)': 'FRA', 'PAT Testing': 'PAT', 'Legionella Risk Assessment': 'Legionella',
    'EPC': 'EPC', 'HMO Licence': 'HMOLicence', 'Asbestos Survey': 'Asbestos',
    'Building Control Certificate': 'BuildingControl', 'Buildings Insurance Schedule': 'Insurance',
  };
  const typeCode = typeCodes[complianceType] || complianceType.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  const addressPart = propertyAddress.split(',')[0].trim().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '').substring(0, 30);
  const dateStr = new Date().toISOString().split('T')[0];
  const extMatch = originalFilename.match(/\.[^.]+$/);
  const extension = extMatch ? extMatch[0].toLowerCase() : '.pdf';
  return `${typeCode}_${addressPart}_${dateStr}${extension}`;
}

// Auto-filing: creates compliance_items and compliance_documents records
async function autoFileDocument(
  supabase: ReturnType<typeof createClient>,
  extraction: AIExtractionResult,
  documentId: string,
  orgId: string,
  fileUrl: string,
  originalFilename: string,
  propertyAddress: string,
  userId: string,
): Promise<{ success: boolean; complianceItemId?: string; error?: string }> {
  try {
    const complianceType = extraction.compliance_type;
    if (!complianceType || !extraction.matched_property_id) {
      return { success: false, error: 'Missing compliance type or property' };
    }

    const calculatedExpiryDate = calculateExpiryDate(
      extraction.doc_type, extraction.extracted_issue_date, extraction.extracted_expiry_date
    );

    // Check existing compliance item
    const { data: existingItems } = await supabase
      .from('compliance_items')
      .select('id')
      .eq('property_id', extraction.matched_property_id)
      .eq('compliance_type', complianceType)
      .limit(1);

    let complianceItemId: string;

    if (existingItems && existingItems.length > 0) {
      complianceItemId = existingItems[0].id;
      await supabase.from('compliance_items').update({
        issue_date: extraction.extracted_issue_date,
        expiry_date: calculatedExpiryDate,
        notes: 'Auto-updated via AI Document Processing',
      }).eq('id', complianceItemId);
    } else {
      const { data: newItem, error: createError } = await supabase
        .from('compliance_items')
        .insert({
          property_id: extraction.matched_property_id,
          org_id: orgId,
          compliance_type: complianceType,
          issue_date: extraction.extracted_issue_date,
          expiry_date: calculatedExpiryDate,
          responsible_party: 'Owner',
          reminder_days: DEFAULT_REMINDER_DAYS,
          notes: 'Auto-created via AI Document Processing',
        })
        .select()
        .single();
      if (createError) return { success: false, error: createError.message };
      complianceItemId = newItem.id;
    }

    // Archive previous documents
    await supabase.from('compliance_documents').update({
      is_current: false, archived_at: new Date().toISOString()
    }).eq('compliance_item_id', complianceItemId).eq('is_current', true);

    // Get next version
    const { data: existingDocs } = await supabase
      .from('compliance_documents')
      .select('version_number')
      .eq('compliance_item_id', complianceItemId)
      .order('version_number', { ascending: false })
      .limit(1);
    const nextVersion = existingDocs?.[0]?.version_number ? existingDocs[0].version_number + 1 : 1;

    // Generate filename and copy file
    const structuredFilename = generateComplianceFilename(complianceType, propertyAddress, originalFilename);
    const sourcePath = fileUrl.includes('/documents/') ? fileUrl.split('/documents/')[1] : fileUrl;

    if (sourcePath) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents').download(sourcePath);
      if (!downloadError && fileData) {
        const compliancePath = `${extraction.matched_property_id}/${complianceItemId}/${Date.now()}_${structuredFilename}`;
        await supabase.storage.from('compliance').upload(compliancePath, fileData);
        const { data: urlData } = supabase.storage.from('compliance').getPublicUrl(compliancePath);

        await supabase.from('compliance_documents').insert({
          compliance_item_id: complianceItemId,
          file_url: urlData.publicUrl,
          original_file_name: structuredFilename,
          file_type: originalFilename.split('.').pop() || 'pdf',
          uploaded_by: userId,
          is_current: true,
          version_number: nextVersion,
          notes: 'Auto-filed via AI Document Processing',
        });
      }
    }

    // Update document record
    await supabase.from('documents').update({
      review_status: 'accepted',
      auto_filed: true,
      doc_type: extraction.doc_type,
      property_id: extraction.matched_property_id,
      compliance_item_id: complianceItemId,
      final_file_name: structuredFilename,
      renamed_at: new Date().toISOString(),
    }).eq('id', documentId);

    // Sync EPC rating
    if (extraction.doc_type === 'epc_certificate' && extraction.extracted_epc_rating) {
      await supabase.from('properties').update({ epc_rating: extraction.extracted_epc_rating })
        .eq('id', extraction.matched_property_id);
    }

    // Sync insurance
    if (extraction.doc_type === 'building_insurance' || extraction.doc_type === 'public_liability_insurance') {
      const insurerName = extraction.extracted_certifier_company || 'Unknown Insurer';
      const renewalDate = calculatedExpiryDate || extraction.extracted_expiry_date;
      if (renewalDate) {
        const { data: existingPolicy } = await supabase.from('insurance_policies')
          .select('id').eq('property_id', extraction.matched_property_id).limit(1);
        if (existingPolicy?.length) {
          await supabase.from('insurance_policies').update({
            insurer_name: insurerName, renewal_date: renewalDate,
            policy_number: extraction.extracted_reference_number,
            start_date: extraction.extracted_issue_date, status: 'active',
            notes: 'Auto-updated from AI Document Processing',
          }).eq('id', existingPolicy[0].id);
        } else {
          await supabase.from('insurance_policies').insert({
            org_id: orgId, property_id: extraction.matched_property_id,
            insurer_name: insurerName, renewal_date: renewalDate,
            policy_number: extraction.extracted_reference_number,
            start_date: extraction.extracted_issue_date, premium_gbp: 0,
            status: 'active', notes: 'Auto-created from AI Document Processing',
          });
        }
      }
    }

    return { success: true, complianceItemId };
  } catch (err) {
    console.error('Auto-filing error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: claimsData, error: claimsError } = await userSupabase.auth.getUser();
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let rawBody: unknown;
    try { rawBody = await req.json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = rawBody as Record<string, unknown>;
    const documentId = typeof body.documentId === 'string' ? body.documentId : null;
    const fileUrl = typeof body.fileUrl === 'string' ? body.fileUrl : null;
    const properties = Array.isArray(body.properties) ? body.properties : null;

    if (!documentId || !isValidUUID(documentId)) {
      return new Response(JSON.stringify({ error: 'Invalid or missing documentId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!fileUrl || fileUrl.length > 2048) {
      return new Response(JSON.stringify({ error: 'Invalid or missing fileUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!properties || properties.length > 500) {
      return new Response(JSON.stringify({ error: 'Invalid or missing properties array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate properties
    const validatedProperties: Array<{ id: string; address_line: string; postcode: string | null; title_number?: string | null }> = [];
    for (const p of properties) {
      if (typeof p !== 'object' || p === null || !isValidUUID(p.id) || typeof p.address_line !== 'string') {
        return new Response(JSON.stringify({ error: 'Invalid property entry' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      validatedProperties.push({
        id: p.id, address_line: p.address_line.slice(0, 500),
        postcode: typeof p.postcode === 'string' ? p.postcode.slice(0, 20) : null,
        title_number: typeof p.title_number === 'string' ? p.title_number.slice(0, 50) : null,
      });
    }

    // Verify document access
    const { data: docAccess, error: accessError } = await userSupabase
      .from("documents").select("id, org_id").eq("id", documentId).single();
    if (accessError || !docAccess) {
      return new Response(JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update status
    await supabase.from("documents").update({ extraction_status: "processing" }).eq("id", documentId);

    // Fetch auto-file threshold from org settings (default 0.85)
    let autoFileThreshold = 0.85;
    let autoProcessEnabled = true;
    const { data: orgSettings } = await supabase.from("app_settings")
      .select("setting_key, setting_value")
      .eq("org_id", docAccess.org_id)
      .in("setting_key", ["ai_auto_file_threshold", "ai_auto_process_enabled"]);

    if (orgSettings) {
      for (const s of orgSettings) {
        if (s.setting_key === 'ai_auto_file_threshold' && s.setting_value) {
          autoFileThreshold = parseFloat(s.setting_value) || 0.85;
        }
        if (s.setting_key === 'ai_auto_process_enabled') {
          autoProcessEnabled = s.setting_value !== 'false';
        }
      }
    }

    // Fetch file
    console.log(`Fetching file: ${fileUrl}`);
    const { dataUrl, mimeType } = await fetchFileAsDataUrl(fileUrl);
    console.log(`MIME: ${mimeType}`);

    // Build AI prompt
    const propertyList = validatedProperties
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

    // Call AI
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
          { role: "user", content: [
            { type: "text", text: "Analyze this compliance document and extract all required information." },
            { type: "image_url", image_url: { url: dataUrl } },
          ]},
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        await supabase.from("documents").update({ extraction_status: "rate_limited" }).eq("id", documentId);
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        await supabase.from("documents").update({ extraction_status: "credits_exhausted" }).eq("id", documentId);
        return new Response(JSON.stringify({ error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices?.[0]?.message?.content || "";
    const tokensUsed = aiData.usage?.total_tokens || 0;

    // Parse AI response
    let extraction: AIExtractionResult;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      const parsed = JSON.parse(jsonMatch[0]);
      const complianceType = DOC_TYPE_TO_COMPLIANCE_TYPE[parsed.doc_type] || null;
      const validPropertyId = isValidUUID(parsed.matched_property_id) ? parsed.matched_property_id : null;
      extraction = { ...parsed, matched_property_id: validPropertyId, compliance_type: complianceType };
    } catch {
      extraction = {
        doc_type: "other", doc_type_confidence: 0.5,
        matched_property_id: null, property_confidence: 0,
        extracted_address: null, extracted_postcode: null, extracted_title_number: null,
        extracted_expiry_date: null, extracted_issue_date: null, extracted_reference_number: null,
        extracted_epc_rating: null, extracted_certifier_name: null, extracted_certifier_company: null,
        compliance_type: null,
      };
    }

    const processingTimeMs = Date.now() - startTime;

    // Validate extraction
    const validationErrors: string[] = [];
    const validationWarnings: string[] = [];

    if (extraction.extracted_issue_date) {
      const issueDate = new Date(extraction.extracted_issue_date);
      if (issueDate > new Date()) validationErrors.push('Issue date is in the future');
    }
    if (extraction.extracted_issue_date && extraction.extracted_expiry_date) {
      if (new Date(extraction.extracted_expiry_date) < new Date(extraction.extracted_issue_date)) {
        validationErrors.push('Expiry date is before issue date');
      }
    }
    if (extraction.doc_type_confidence < 0.5) validationErrors.push('Classification confidence too low');
    if (!extraction.matched_property_id) validationWarnings.push('No property match found');
    if (extraction.property_confidence > 0 && extraction.property_confidence < 0.7) {
      validationWarnings.push('Low property match confidence');
    }

    // Determine if auto-filing should happen
    const canAutoFile = autoProcessEnabled &&
      extraction.doc_type_confidence >= autoFileThreshold &&
      extraction.property_confidence >= autoFileThreshold &&
      extraction.matched_property_id &&
      extraction.compliance_type &&
      validationErrors.length === 0;

    // Update document with AI results
    const updateData: Record<string, unknown> = {
      extraction_status: "completed",
      ai_suggested_doc_type: extraction.doc_type,
      ai_doc_type_confidence: extraction.doc_type_confidence,
      ai_suggested_property_id: extraction.matched_property_id,
      ai_property_confidence: extraction.property_confidence,
      extracted_address_text: extraction.extracted_address,
      extracted_reference_number: extraction.extracted_reference_number,
      extracted_epc_rating: extraction.extracted_epc_rating,
      extracted_certifier_name: extraction.extracted_certifier_name,
      extracted_certifier_company: extraction.extracted_certifier_company,
      processing_time_ms: processingTimeMs,
      ai_tokens_used: tokensUsed,
      ai_model: "google/gemini-2.5-flash",
      auto_file_confidence: Math.min(extraction.doc_type_confidence, extraction.property_confidence),
      extracted_data: extraction,
      validation_errors: validationErrors.length > 0 ? validationErrors : null,
      validation_warnings: validationWarnings.length > 0 ? validationWarnings : null,
    };

    if (extraction.extracted_expiry_date) {
      const d = new Date(extraction.extracted_expiry_date);
      if (!isNaN(d.getTime())) updateData.expiry_date = extraction.extracted_expiry_date;
    }
    if (extraction.extracted_issue_date) {
      const d = new Date(extraction.extracted_issue_date);
      if (!isNaN(d.getTime())) updateData.extracted_issue_date = extraction.extracted_issue_date;
    }

    await supabase.from("documents").update(updateData).eq("id", documentId);

    // Auto-file if criteria met
    let autoFiled = false;
    let autoFileResult = null;
    if (canAutoFile) {
      const matchedProperty = validatedProperties.find(p => p.id === extraction.matched_property_id);
      if (matchedProperty) {
        const originalDoc = await supabase.from("documents")
          .select("file_url, original_file_name").eq("id", documentId).single();
        if (originalDoc.data) {
          autoFileResult = await autoFileDocument(
            supabase, extraction, documentId, docAccess.org_id,
            originalDoc.data.file_url, originalDoc.data.original_file_name,
            matchedProperty.address_line, claimsData.user.id,
          );
          autoFiled = autoFileResult.success;
        }
      }
    }

    console.log(`Document ${documentId} processed in ${processingTimeMs}ms. Auto-filed: ${autoFiled}`);

    return new Response(
      JSON.stringify({
        success: true, extraction, compliance_type: extraction.compliance_type,
        auto_filed: autoFiled, auto_file_result: autoFileResult,
        processing_time_ms: processingTimeMs, tokens_used: tokensUsed,
        validation_errors: validationErrors, validation_warnings: validationWarnings,
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
