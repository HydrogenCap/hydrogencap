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
}

function categoriseByRules(doc: DocInput): string | null {
  // 1. Use doc_type mapping if available
  if (doc.doc_type && doc.doc_type !== "other" && DOC_TYPE_TO_CATEGORY[doc.doc_type]) {
    return DOC_TYPE_TO_CATEGORY[doc.doc_type];
  }

  // 2. Try filename keywords
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

    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
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

    // Fetch all uncategorised (or "other") documents
    const { data: docs, error: fetchErr } = await supabase
      .from("documents")
      .select("id, original_file_name, display_name, doc_type, description, category")
      .is("deleted_at", null);

    if (fetchErr) throw fetchErr;

    const results: { id: string; oldCategory: string | null; newCategory: string; method: string }[] = [];
    const unchanged: string[] = [];
    const needsAi: DocInput[] = [];

    for (const doc of (docs || []) as DocInput[]) {
      const ruleCategory = categoriseByRules(doc);

      if (ruleCategory && ruleCategory !== doc.category) {
        results.push({
          id: doc.id,
          oldCategory: doc.category,
          newCategory: ruleCategory,
          method: "rules",
        });
      } else if (!ruleCategory && (!doc.category || doc.category === "other")) {
        needsAi.push(doc);
      } else {
        unchanged.push(doc.id);
      }
    }

    // Use AI for remaining uncategorised documents
    if (needsAi.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        // Batch in groups of 30
        const batches: DocInput[][] = [];
        for (let i = 0; i < needsAi.length; i += 30) {
          batches.push(needsAi.slice(i, i + 30));
        }

        const validCategories = [
          "legal-pack", "contracts", "licences-permits", "mortgage-offers", "valuations",
          "insurance", "tax-accounts", "invoices-receipts", "surveys", "floor-plans",
          "photos", "inventories", "tenancy-agreements", "tenant-references", "rent-statements",
          "board-minutes", "share-certificates", "company-formation", "correspondence",
          "gas-safety", "eicr", "epc", "fire-safety", "hmo-licence", "planning",
          "building-control", "id-document", "shareholder-agreement", "title-deeds", "other",
        ];

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
              // Extract JSON array from response
              const jsonMatch = content.match(/\[[\s\S]*?\]/);
              if (jsonMatch) {
                const classifications = JSON.parse(jsonMatch[0]) as { index: number; category: string }[];
                for (const c of classifications) {
                  const doc = batch[c.index - 1];
                  if (doc && validCategories.includes(c.category) && c.category !== doc.category) {
                    results.push({
                      id: doc.id,
                      oldCategory: doc.category,
                      newCategory: c.category,
                      method: "ai",
                    });
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

    // Apply updates unless dry run
    if (!dryRun && results.length > 0) {
      // Batch update by category
      const byCat = new Map<string, string[]>();
      for (const r of results) {
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

    return new Response(
      JSON.stringify({
        updated: results.length,
        unchanged: unchanged.length + needsAi.length - results.filter(r => r.method === "ai").length,
        details: results,
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
