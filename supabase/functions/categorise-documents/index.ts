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
  legionella_assessment: "other",
  pat_testing: "other",
  mcs_certificate: "other",
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
  [/legionella/i, "other"],
  [/pat\s*test/i, "other"],
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
      "building-control", "id-document", "shareholder-agreement", "title-deeds", "other",
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

    // Phase 2: Renaming — generate display_name for docs that don't have one (or have a poor one)
    const renameResults: { id: string; oldName: string | null; newName: string }[] = [];

    // Collect docs needing AI rename (no display_name or display_name equals original_file_name)
    const needsAiRename: DocInput[] = [];

    for (const doc of (docs || []) as DocInput[]) {
      const category = docCategoryMap.get(doc.id) || doc.category || "other";
      const propAddr = doc.property_id ? propertyMap.get(doc.property_id) || null : null;
      const compName = doc.company_id ? companyMap.get(doc.company_id) || null : null;

      // Skip docs that already have a professionally structured display_name
      // (contains underscore separators and doesn't match original filename)
      const hasStructuredName = doc.display_name && 
        doc.display_name !== doc.original_file_name &&
        doc.display_name !== doc.original_file_name.replace(/\.[^/.]+$/, "") &&
        doc.display_name.includes("_") &&
        doc.display_name !== "download";
      
      if (hasStructuredName) {
        continue;
      }

      // If we have enough context, generate deterministically
      if (category !== "other" || doc.doc_type) {
        const newDisplayName = generateDisplayName(doc, category, propAddr, compName);
        if (newDisplayName !== doc.display_name) {
          renameResults.push({
            id: doc.id,
            oldName: doc.display_name,
            newName: newDisplayName,
          });
        }
      } else {
        // Need AI help to figure out a good name
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
