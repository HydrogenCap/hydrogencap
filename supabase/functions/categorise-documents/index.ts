import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Deterministic mapping from doc_type → vault category slug
const DOC_TYPE_TO_CATEGORY: Record<string, string> = {
  gas_safety_certificate: "gas-safety",
  electrical_certificate: "eicr",
  epc_certificate: "epc",
  fire_alarm_certificate: "fire-safety",
  fire_risk_assessment: "fire-safety",
  fire_suppression_certificate: "fire-safety",
  fire_door_certification: "fire-safety",
  fire_panel_commissioning: "fire-safety",
  emergency_lighting_certificate: "fire-safety",
  hmo_licence: "hmo-licence",
  building_insurance: "insurance",
  public_liability_insurance: "insurance",
  legionella_assessment: "legionella",
  pat_testing: "pat-testing",
  mcs_certificate: "mcs-certificate",
  floor_plan: "floor-plans",
};

// Category slug → short label for display names
const CATEGORY_LABEL: Record<string, string> = {
  "gas-safety": "GasCert",
  "eicr": "EICR",
  "epc": "EPC",
  "fire-safety": "FireSafety",
  "hmo-licence": "HMOLicence",
  "insurance": "Insurance",
  "mortgage-offers": "Mortgage",
  "valuations": "Valuation",
  "surveys": "Survey",
  "floor-plans": "FloorPlan",
  "inventories": "Inventory",
  "invoices-receipts": "Invoice",
  "tenancy-agreements": "TenancyAgreement",
  "tenant-references": "TenantRef",
  "rent-statements": "RentStatement",
  "legal-pack": "LegalPack",
  "board-minutes": "BoardMinutes",
  "share-certificates": "ShareCert",
  "company-formation": "CompanyFormation",
  "correspondence": "Correspondence",
  "planning": "Planning",
  "building-control": "BuildingControl",
  "tax-accounts": "TaxAccounts",
  "title-deeds": "TitleDeeds",
  "shareholder-agreement": "ShareholderAgreement",
  "id-document": "ID",
  "contracts": "Contract",
  "licences-permits": "Licence",
  "photos": "Photo",
  "pat-testing": "PATTest",
  "legionella": "Legionella",
  "mcs-certificate": "MCSCert",
  "other": "Document",
};

// Doc type → more specific label overrides
const DOC_TYPE_LABEL: Record<string, string> = {
  fire_alarm_certificate: "FireAlarm",
  fire_risk_assessment: "FireRiskAssessment",
  fire_suppression_certificate: "FireSuppression",
  fire_door_certification: "FireDoor",
  fire_panel_commissioning: "FirePanel",
  emergency_lighting_certificate: "EmergencyLighting",
  building_insurance: "Insurance",
  public_liability_insurance: "PublicLiability",
  legionella_assessment: "Legionella",
  pat_testing: "PATTest",
  mcs_certificate: "MCSCert",
  gas_safety_certificate: "GasCert",
  electrical_certificate: "EICR",
  epc_certificate: "EPC",
  hmo_licence: "HMOLicence",
};

// Filename keyword fallback mapping
const FILENAME_KEYWORDS: [RegExp, string][] = [
  [/gas\s*safe|gas\s*cert/i, "gas-safety"],
  [/eicr|electri/i, "eicr"],
  [/epc|energy\s*perf/i, "epc"],
  [/fire\s*(alarm|risk|door|panel|suppress|safety)|fsm/i, "fire-safety"],
  [/hmo\s*licen/i, "hmo-licence"],
  [/insurance|policy\s*doc|homelett?/i, "insurance"],
  [/mortgage|lend|offer/i, "mortgage-offers"],
  [/valuation/i, "valuations"],
  [/survey/i, "surveys"],
  [/floor\s*plan/i, "floor-plans"],
  [/inventory/i, "inventories"],
  [/invoice|receipt/i, "invoices-receipts"],
  [/tenancy\s*agree|ast\b|assured\s*short/i, "tenancy-agreements"],
  [/rent\s*state/i, "rent-statements"],
  [/legal\s*pack|title\s*deed|land\s*reg/i, "legal-pack"],
  [/board\s*minute/i, "board-minutes"],
  [/share\s*cert/i, "share-certificates"],
  [/company\s*form|cert\s*of\s*incorp/i, "company-formation"],
  [/planning|permitted\s*dev/i, "planning"],
  [/build.*control/i, "building-control"],
  [/tax|account|sa\s*\d{3}/i, "tax-accounts"],
  [/tenant\s*ref/i, "tenant-references"],
  [/correspond|letter/i, "correspondence"],
  [/photo|image|img/i, "photos"],
  [/contract/i, "contracts"],
  [/licence|permit/i, "licences-permits"],
  [/quote/i, "other"],
  [/reference/i, "other"],
  [/id\s*doc|passport|driv.*licen/i, "id-document"],
  [/emergency\s*light/i, "fire-safety"],
  [/legionella/i, "legionella"],
  [/pat\s*test/i, "pat-testing"],
  [/mcs\s*cert/i, "mcs-certificate"],
];

interface DocInput {
  id: string;
  original_file_name: string;
  display_name: string | null;
  doc_type: string | null;
  description: string | null;
  category: string | null;
  property_id: string | null;
  company_id: string | null;
  created_at: string;
}

function categoriseByRules(doc: DocInput): string | null {
  if (doc.doc_type && doc.doc_type !== "other" && DOC_TYPE_TO_CATEGORY[doc.doc_type]) {
    return DOC_TYPE_TO_CATEGORY[doc.doc_type];
  }
  const searchText = [doc.original_file_name, doc.display_name, doc.description]
    .filter(Boolean)
    .join(" ");
  for (const [regex, category] of FILENAME_KEYWORDS) {
    if (regex.test(searchText)) {
      return category;
    }
  }
  return null;
}

function sanitiseForFilename(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.substring(lastDot).toLowerCase();
}

function generateDisplayName(
  doc: DocInput,
  category: string,
  propertyAddress: string | null,
  companyName: string | null
): string {
  // Determine label
  const label = (doc.doc_type && DOC_TYPE_LABEL[doc.doc_type]) ||
    CATEGORY_LABEL[category] ||
    "Document";

  // Determine entity
  let entity = "";
  if (propertyAddress) {
    entity = sanitiseForFilename(propertyAddress);
  } else if (companyName) {
    entity = sanitiseForFilename(companyName);
  }

  // Date from created_at
  const dateStr = doc.created_at ? doc.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10);

  // Extension
  const ext = getFileExtension(doc.original_file_name);

  // Build: Label_Entity_Date.ext
  const parts = [label];
  if (entity) parts.push(entity);
  parts.push(dateStr);

  return parts.join("_") + ext;
}

function generateFinalFileName(
  category: string,
  entityName: string | null,
  displayName: string,
  dateStr: string,
  ext: string
): string {
  // Format: {CategoryCode}_{Entity}_{DisplayName}_{Date}.ext
  const catCode = CATEGORY_LABEL[category] || "DOC";
  const entity = entityName ? sanitiseForFilename(entityName) : "General";
  const cleanDisplay = sanitiseForFilename(displayName.replace(ext, ""));

  return `${catCode}_${entity}_${cleanDisplay}_${dateStr}${ext}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { dryRun = false } = await req.json().catch(() => ({}));

    // Fetch all documents with property/company info
    const { data: docs, error: fetchErr } = await supabase
      .from("documents")
      .select("id, original_file_name, display_name, doc_type, description, category, property_id, company_id, created_at")
      .is("deleted_at", null);

    if (fetchErr) throw fetchErr;

    // Fetch properties and companies for naming
    const propertyIds = [...new Set((docs || []).map(d => d.property_id).filter(Boolean))];
    const companyIds = [...new Set((docs || []).map(d => d.company_id).filter(Boolean))];

    const propertyMap = new Map<string, string>();
    const companyMap = new Map<string, string>();

    if (propertyIds.length > 0) {
      const { data: props } = await supabase
        .from("properties")
        .select("id, address_line")
        .in("id", propertyIds);
      for (const p of props || []) {
        propertyMap.set(p.id, p.address_line || "");
      }
    }

    if (companyIds.length > 0) {
      const { data: comps } = await supabase
        .from("companies")
        .select("id, legal_name")
        .in("id", companyIds);
      for (const c of comps || []) {
        companyMap.set(c.id, c.legal_name || "");
      }
    }

    // Phase 1: Categorisation
    const catResults: { id: string; oldCategory: string | null; newCategory: string; method: string }[] = [];
    const unchanged: string[] = [];
    const needsAi: DocInput[] = [];

    // Track final category per doc for renaming phase
    const docCategoryMap = new Map<string, string>();

    for (const doc of (docs || []) as DocInput[]) {
      const ruleCategory = categoriseByRules(doc);

      if (ruleCategory && ruleCategory !== doc.category) {
        catResults.push({
          id: doc.id,
          oldCategory: doc.category,
          newCategory: ruleCategory,
          method: "rules",
        });
        docCategoryMap.set(doc.id, ruleCategory);
      } else if (!ruleCategory && (!doc.category || doc.category === "other")) {
        needsAi.push(doc);
      } else {
        unchanged.push(doc.id);
        docCategoryMap.set(doc.id, doc.category || "other");
      }
    }

    // AI categorisation for unknowns
    const validCategories = [
      "legal-pack", "contracts", "licences-permits", "mortgage-offers", "valuations",
      "insurance", "tax-accounts", "invoices-receipts", "surveys", "floor-plans",
      "photos", "inventories", "tenancy-agreements", "tenant-references", "rent-statements",
      "board-minutes", "share-certificates", "company-formation", "correspondence",
      "gas-safety", "eicr", "epc", "fire-safety", "hmo-licence", "planning",
      "building-control", "id-document", "shareholder-agreement", "title-deeds",
      "pat-testing", "legionella", "mcs-certificate", "other",
    ];

    if (needsAi.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const batches: DocInput[][] = [];
        for (let i = 0; i < needsAi.length; i += 30) {
          batches.push(needsAi.slice(i, i + 30));
        }

        for (const batch of batches) {
          const prompt = `Categorise each document into one of these category slugs based on its filename and metadata:
${JSON.stringify(validCategories)}

Documents:
${batch.map((d, i) => `${i + 1}. filename: "${d.original_file_name}"${d.display_name ? `, display: "${d.display_name}"` : ""}${d.description ? `, desc: "${d.description}"` : ""}${d.doc_type ? `, type: "${d.doc_type}"` : ""}`).join("\n")}

Return ONLY a JSON array of objects: [{"index": 1, "category": "slug"}]`;

          try {
            const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: "You classify UK property management documents. Return only valid JSON." },
                  { role: "user", content: prompt },
                ],
              }),
            });

            if (aiResp.ok) {
              const aiData = await aiResp.json();
              const content = aiData.choices?.[0]?.message?.content || "";
              const jsonMatch = content.match(/\[[\s\S]*?\]/);
              if (jsonMatch) {
                const classifications = JSON.parse(jsonMatch[0]) as { index: number; category: string }[];
                for (const c of classifications) {
                  const doc = batch[c.index - 1];
                  if (doc && validCategories.includes(c.category) && c.category !== doc.category) {
                    catResults.push({
                      id: doc.id,
                      oldCategory: doc.category,
                      newCategory: c.category,
                      method: "ai",
                    });
                    docCategoryMap.set(doc.id, c.category);
                  } else if (doc) {
                    docCategoryMap.set(doc.id, doc.category || "other");
                  }
                }
              }
            }
          } catch (e) {
            console.error("AI batch error:", e);
          }
        }
      }

    }

    // ── Phase 1b: Content-based AI vision for ALL docs needing better analysis ──
    // This covers: docs still in "other", docs with generic filenames (download.pdf),
    // and docs missing property/company associations.
    const LOVABLE_API_KEY_VISION = Deno.env.get("LOVABLE_API_KEY");

    // Fetch all companies and properties for matching
    const { data: allCompanies } = await supabase.from("companies").select("id, legal_name");
    const { data: allProperties } = await supabase.from("properties").select("id, address_line, postcode");

    const companyList = (allCompanies || []).map(c => ({ id: c.id, name: c.legal_name }));
    const propertyList = (allProperties || []).map(p => ({ id: p.id, address: p.address_line, postcode: p.postcode }));

    // Identify docs that need vision analysis:
    // 1. Still categorised as "other"
    // 2. Have generic filenames (download, unnamed, untitled, document)
    // 3. Missing property_id and company_id
    const needsVision = (docs || []).filter((d: DocInput) => {
      const cat = docCategoryMap.get(d.id) || d.category || "other";
      const isGenericName = /^(download|unnamed|untitled|document|file)\s*(\(\d+\))?$/i.test(
        d.original_file_name.replace(/\.[^/.]+$/, "")
      );
      const isOther = cat === "other";
      const missingLinks = !d.property_id && !d.company_id;
      return isOther || isGenericName || (missingLinks && cat !== "other");
    });

    // Store vision results for use in renaming phase
    const visionInsights = new Map<string, {
      title?: string;
      category?: string;
      doc_type?: string;
      company_name?: string;
      property_address?: string;
      date?: string;
    }>();

    if (needsVision.length > 0 && LOVABLE_API_KEY_VISION) {
      // Process up to 10 docs with vision
      const visionBatch = needsVision.slice(0, 10);

      for (const doc of visionBatch) {
        try {
          const { data: fullDoc } = await supabase
            .from("documents")
            .select("file_url")
            .eq("id", doc.id)
            .single();

          if (!fullDoc?.file_url) continue;

          const urlParts = fullDoc.file_url.split("/documents/");
          if (urlParts.length < 2) continue;
          const storagePath = urlParts[urlParts.length - 1].split("?")[0];

          const { data: fileData, error: dlErr } = await supabase.storage
            .from("documents")
            .download(storagePath);

          if (dlErr || !fileData) {
            console.error("Failed to download doc for vision:", doc.id, dlErr);
            continue;
          }

          const arrayBuf = await fileData.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          // Build base64 in chunks to avoid stack overflow
          let base64 = "";
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            base64 += String.fromCharCode(...bytes.slice(i, i + chunkSize));
          }
          base64 = btoa(base64);
          const mimeType = fileData.type || "application/pdf";
          const dataUrl = `data:${mimeType};base64,${base64}`;

          const visionPrompt = `Analyse this UK property management document carefully and extract:

1. **category**: classify into exactly ONE of: ${JSON.stringify(validCategories)}
2. **doc_type**: one of gas_safety_certificate, electrical_certificate, epc_certificate, fire_alarm_certificate, fire_risk_assessment, emergency_lighting_certificate, hmo_licence, building_insurance, pat_testing, legionella_assessment, mcs_certificate, or null
3. **title**: a concise descriptive title for this document (e.g. "Certificate of Incorporation", "Gas Safety Record", "EICR Report")
4. **company_name**: any company/limited company name mentioned (e.g. "PINETO LTD", "HYDROGEN CAPITAL LTD"), or null
5. **property_address**: any property address mentioned in the document, or null
6. **date**: the most relevant date (issue date, certificate date) in YYYY-MM-DD format, or null

Known companies in this portfolio: ${companyList.map(c => c.name).join(", ")}
Known properties: ${propertyList.map(p => `${p.address} ${p.postcode}`).join(", ")}

Return ONLY JSON: {"category":"slug","doc_type":"type_or_null","title":"string","company_name":"name_or_null","property_address":"address_or_null","date":"YYYY-MM-DD_or_null"}`;

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY_VISION}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "You analyse UK property management documents. Extract structured metadata accurately. Return only valid JSON." },
                { role: "user", content: [
                  { type: "image_url", image_url: { url: dataUrl } },
                  { type: "text", text: visionPrompt },
                ]},
              ],
            }),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const content = aiData.choices?.[0]?.message?.content || "";
            const jsonMatch = content.match(/\{[\s\S]*?\}/);
            if (jsonMatch) {
              const result = JSON.parse(jsonMatch[0]) as {
                category?: string;
                doc_type?: string;
                title?: string;
                company_name?: string;
                property_address?: string;
                date?: string;
              };

              visionInsights.set(doc.id, result);

              // Update category if better than current
              const currentCat = docCategoryMap.get(doc.id) || doc.category || "other";
              if (result.category && validCategories.includes(result.category) && result.category !== "other" && currentCat === "other") {
                catResults.push({
                  id: doc.id,
                  oldCategory: doc.category,
                  newCategory: result.category,
                  method: "ai_vision",
                });
                docCategoryMap.set(doc.id, result.category);
              }

              // Update doc_type
              if (result.doc_type && !doc.doc_type) {
                await supabase.from("documents").update({ doc_type: result.doc_type }).eq("id", doc.id);
              }

              // Match company
              if (result.company_name && !doc.company_id) {
                const normalised = result.company_name.toUpperCase().replace(/\s+/g, " ").trim();
                const match = companyList.find(c => 
                  c.name.toUpperCase() === normalised ||
                  c.name.toUpperCase().includes(normalised) ||
                  normalised.includes(c.name.toUpperCase())
                );
                if (match) {
                  await supabase.from("documents").update({ company_id: match.id }).eq("id", doc.id);
                  companyMap.set(match.id, match.name);
                  // Update in-memory doc reference
                  (doc as any).company_id = match.id;
                }
              }

              // Match property
              if (result.property_address && !doc.property_id) {
                const normAddr = result.property_address.toUpperCase().replace(/[^A-Z0-9]/g, "");
                const match = propertyList.find(p => {
                  const pNorm = (p.address + " " + p.postcode).toUpperCase().replace(/[^A-Z0-9]/g, "");
                  return pNorm.includes(normAddr) || normAddr.includes(pNorm) ||
                    // Try postcode match + partial address
                    (p.postcode && normAddr.includes(p.postcode.replace(/\s/g, "").toUpperCase()));
                });
                if (match) {
                  await supabase.from("documents").update({ property_id: match.id }).eq("id", doc.id);
                  propertyMap.set(match.id, match.address || "");
                  (doc as any).property_id = match.id;
                }
              }

              // Update document_date if extracted
              if (result.date) {
                await supabase.from("documents").update({ document_date: result.date }).eq("id", doc.id);
              }
            }
          }
        } catch (e) {
          console.error("Vision analysis error for doc:", doc.id, e);
        }
      }
    }

    // Phase 2: Renaming — generate display_name for docs that don't have one (or have a poor one)
    const renameResults: { id: string; oldName: string | null; newName: string }[] = [];

    // Collect docs needing AI rename (no display_name or display_name equals original_file_name)
    const needsAiRename: DocInput[] = [];

    for (const doc of (docs || []) as DocInput[]) {
      const category = docCategoryMap.get(doc.id) || doc.category || "other";
      const propAddr = doc.property_id ? propertyMap.get(doc.property_id) || null : null;
      const compName = doc.company_id ? companyMap.get(doc.company_id) || null : null;

      // Check if vision gave us better naming info
      const vision = visionInsights.get(doc.id);

      // Skip docs that already have a professionally structured display_name
      // BUT re-process if vision found new entity links or the name is clearly placeholder
      const hasStructuredName = doc.display_name && 
        doc.display_name !== doc.original_file_name &&
        doc.display_name !== doc.original_file_name.replace(/\.[^/.]+$/, "") &&
        doc.display_name.includes("_") &&
        doc.display_name !== "download" &&
        !doc.display_name.includes("Unknown") &&
        !doc.display_name.includes("YYYY");
      
      const visionImprovedContext = vision && (vision.title || vision.company_name || vision.property_address);
      
      if (hasStructuredName && !visionImprovedContext) {
        continue;
      }

      // Use vision title + entity info for better naming
      if (vision?.title && (category !== "other" || doc.doc_type || vision.category)) {
        const effectiveCategory = category !== "other" ? category : (vision.category || "other");
        const effectivePropAddr = propAddr || (vision.property_address ? vision.property_address.split(",")[0].trim() : null);
        const effectiveCompName = compName || vision.company_name || null;
        
        const label = (doc.doc_type && DOC_TYPE_LABEL[doc.doc_type]) ||
          CATEGORY_LABEL[effectiveCategory] ||
          sanitiseForFilename(vision.title);

        let entity = "";
        if (effectivePropAddr) entity = sanitiseForFilename(effectivePropAddr);
        else if (effectiveCompName) entity = sanitiseForFilename(effectiveCompName);

        const dateStr = vision.date || (doc.created_at ? doc.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10));
        const ext = getFileExtension(doc.original_file_name);

        const parts = [label];
        if (entity) parts.push(entity);
        parts.push(dateStr);
        const newDisplayName = parts.join("_") + ext;

        if (newDisplayName !== doc.display_name) {
          renameResults.push({
            id: doc.id,
            oldName: doc.display_name,
            newName: newDisplayName,
          });
        }
      } else if (category !== "other" || doc.doc_type) {
        const newDisplayName = generateDisplayName(doc, category, propAddr, compName);
        if (newDisplayName !== doc.display_name) {
          renameResults.push({
            id: doc.id,
            oldName: doc.display_name,
            newName: newDisplayName,
          });
        }
      } else {
        needsAiRename.push(doc);
      }
    }

    // AI rename for docs we couldn't name deterministically
    if (needsAiRename.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const batches: DocInput[][] = [];
        for (let i = 0; i < needsAiRename.length; i += 30) {
          batches.push(needsAiRename.slice(i, i + 30));
        }

        for (const batch of batches) {
          const prompt = `You are renaming UK property management documents. Generate a clean, professional display name for each document.

Rules:
- Format: {DocType}_{PropertyOrEntity}_{YYYY-MM-DD}.{ext}
- Use PascalCase with no spaces
- DocType examples: GasCert, EICR, EPC, FireAlarm, Insurance, HMOLicence, Mortgage, TenancyAgreement
- Keep property addresses concise (e.g., "29BlenheimWalk" not "29 Blenheim Walk, Gloucester")
- Preserve the file extension

Documents:
${batch.map((d, i) => {
  const propAddr = d.property_id ? propertyMap.get(d.property_id) || "" : "";
  const compName = d.company_id ? companyMap.get(d.company_id) || "" : "";
  return `${i + 1}. filename: "${d.original_file_name}"${propAddr ? `, property: "${propAddr}"` : ""}${compName ? `, company: "${compName}"` : ""}${d.doc_type ? `, type: "${d.doc_type}"` : ""}`;
}).join("\n")}

Return ONLY a JSON array: [{"index": 1, "name": "NewName.pdf"}]`;

          try {
            const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: "You rename documents professionally. Return only valid JSON." },
                  { role: "user", content: prompt },
                ],
              }),
            });

            if (aiResp.ok) {
              const aiData = await aiResp.json();
              const content = aiData.choices?.[0]?.message?.content || "";
              const jsonMatch = content.match(/\[[\s\S]*?\]/);
              if (jsonMatch) {
                const names = JSON.parse(jsonMatch[0]) as { index: number; name: string }[];
                for (const n of names) {
                  const doc = batch[n.index - 1];
                  if (doc && n.name && n.name !== doc.display_name) {
                    renameResults.push({
                      id: doc.id,
                      oldName: doc.display_name,
                      newName: n.name,
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.error("AI rename batch error:", e);
          }
        }
      }
    }

    // Apply updates
    if (!dryRun) {
      // Category updates
      if (catResults.length > 0) {
        const byCat = new Map<string, string[]>();
        for (const r of catResults) {
          const ids = byCat.get(r.newCategory) || [];
          ids.push(r.id);
          byCat.set(r.newCategory, ids);
        }
        for (const [category, ids] of byCat.entries()) {
          const { error: updateErr } = await supabase
            .from("documents")
            .update({ category })
            .in("id", ids);
          if (updateErr) console.error(`Failed to update category ${category}:`, updateErr);
        }
      }

      // Rename updates — individual updates since each has a unique name
      for (const r of renameResults) {
        const doc = (docs || []).find(d => d.id === r.id) as DocInput | undefined;
        const category = docCategoryMap.get(r.id) || "other";
        const propAddr = doc?.property_id ? propertyMap.get(doc.property_id) || null : null;
        const dateStr = doc?.created_at ? doc.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10);
        const ext = getFileExtension(doc?.original_file_name || "");
        const entityName = propAddr || (doc?.company_id ? companyMap.get(doc.company_id) || null : null);

        const finalFileName = generateFinalFileName(category, entityName, r.newName, dateStr, ext);

        const { error: renameErr } = await supabase
          .from("documents")
          .update({
            display_name: r.newName,
            final_file_name: finalFileName,
            renamed_at: new Date().toISOString(),
          })
          .eq("id", r.id);
        if (renameErr) console.error(`Failed to rename doc ${r.id}:`, renameErr);
      }
    }

    return new Response(
      JSON.stringify({
        categorised: catResults.length,
        renamed: renameResults.length,
        unchanged: unchanged.length,
        dryRun,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("categorise-documents error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
