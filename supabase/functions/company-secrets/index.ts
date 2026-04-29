import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { validateBody } from "../_shared/validate.ts";

import { withInvocationLog } from "../_shared/logger.ts";
const secretString = z.string().max(500).nullable().optional();
const SetSchema = z.object({
  action: z.literal("set"),
  company_id: z.string().uuid(),
  auth_code: secretString,
  utr: secretString,
});
const GetSchema = z.object({
  action: z.literal("get"),
  company_id: z.string().uuid(),
});
const BulkSecretItemSchema = z.object({
  company_number: z.string().min(1).max(50),
  auth_code: secretString,
  utr: secretString,
});
const BulkSetSchema = z.object({
  action: z.literal("bulk_set"),
  secrets: z.array(BulkSecretItemSchema).min(1).max(100),
});
const RequestSchema = z.discriminatedUnion("action", [SetSchema, GetSchema, BulkSetSchema]);

// AES-GCM encryption utilities
async function getKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get("COMPANY_SECRETS_KEY");
  if (!keyString) {
    throw new Error("COMPANY_SECRETS_KEY not configured");
  }
  
  // Derive a proper key from the secret string
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);
  
  return crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );
  
  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(ciphertext: string): Promise<string> {
  const key = await getKey();
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );
  
  return new TextDecoder().decode(decrypted);
}

function getLast4(value: string, count = 4): string {
  return value.slice(-count);
}

function getLast2(value: string): string {
  return value.slice(-2);
}

async function getManageableOrgIds(
  supabaseAdmin: any,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .in("role", ["owner", "admin"]);

  if (error || !data) {
    return [];
  }

  return data.map((membership: { org_id: string }) => membership.org_id);
}

serve(withInvocationLog("company-secrets", async (req, _invocationLog) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client for bypassing RLS when needed
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user's auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user client to check permissions
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = await validateBody(req, RequestSchema, corsHeaders);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;
    const { action } = body;

    const manageableOrgIds = await getManageableOrgIds(supabaseAdmin, user.id);
    if (manageableOrgIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions. Admin or Owner role required." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "set") {
      const { company_id, auth_code, utr } = body;
      const { data: company, error: companyError } = await supabaseAdmin
        .from("companies")
        .select("id, org_id")
        .eq("id", company_id)
        .maybeSingle();

      if (companyError || !company || !manageableOrgIds.includes(company.org_id)) {
        return new Response(
          JSON.stringify({ error: "Company not found or access denied" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SET SECRETS
      const secretData: Record<string, unknown> = {
        company_id,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };

      if (auth_code !== undefined) {
        if (auth_code) {
          secretData.auth_code_encrypted = await encrypt(auth_code);
          secretData.auth_code_last4 = getLast2(auth_code); // Use last 2 for auth codes
        } else {
          secretData.auth_code_encrypted = null;
          secretData.auth_code_last4 = null;
        }
      }

      if (utr !== undefined) {
        if (utr) {
          secretData.utr_encrypted = await encrypt(utr);
          secretData.utr_last4 = getLast4(utr); // Use last 4 for UTR
        } else {
          secretData.utr_encrypted = null;
          secretData.utr_last4 = null;
        }
      }

      // Upsert the secrets
      const { error: upsertError } = await supabaseAdmin
        .from("company_secrets")
        .upsert(secretData, { onConflict: "company_id" });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        return new Response(
          JSON.stringify({ error: "Failed to save secrets" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "get") {
      const { company_id } = body;
      const { data: company, error: companyError } = await supabaseAdmin
        .from("companies")
        .select("id, org_id")
        .eq("id", company_id)
        .maybeSingle();

      if (companyError || !company || !manageableOrgIds.includes(company.org_id)) {
        return new Response(
          JSON.stringify({ error: "Company not found or access denied" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // GET SECRETS (DECRYPT)
      const { data: secrets, error: fetchError } = await supabaseAdmin
        .from("company_secrets")
        .select("*")
        .eq("company_id", company_id)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("Fetch error:", fetchError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch secrets" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!secrets) {
        return new Response(
          JSON.stringify({ auth_code: null, utr: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result: Record<string, string | null> = {
        auth_code: null,
        utr: null,
      };

      if (secrets.auth_code_encrypted) {
        try {
          result.auth_code = await decrypt(secrets.auth_code_encrypted);
        } catch {
          console.error("Failed to decrypt auth_code");
        }
      }

      if (secrets.utr_encrypted) {
        try {
          result.utr = await decrypt(secrets.utr_encrypted);
        } catch {
          console.error("Failed to decrypt utr");
        }
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "bulk_set") {
      // BULK SET for admin backfill
      const bulkSecrets = body.secrets;
      const results = [];
      for (const item of bulkSecrets) {
        const { company_number, auth_code: itemAuthCode, utr: itemUtr } = item;
        
        // Find company by company_number
        const { data: targetCompany } = await supabaseAdmin
          .from("companies")
          .select("id, org_id")
          .eq("company_number", company_number)
          .in("org_id", manageableOrgIds)
          .single();

        if (!targetCompany) {
          results.push({ company_number, success: false, error: "Company not found" });
          continue;
        }

        const secretData: Record<string, unknown> = {
          company_id: targetCompany.id,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        };

        if (itemAuthCode) {
          secretData.auth_code_encrypted = await encrypt(itemAuthCode);
          secretData.auth_code_last4 = getLast2(itemAuthCode);
        }

        if (itemUtr) {
          secretData.utr_encrypted = await encrypt(itemUtr);
          secretData.utr_last4 = getLast4(itemUtr);
        }

        const { error: bulkUpsertError } = await supabaseAdmin
          .from("company_secrets")
          .upsert(secretData, { onConflict: "company_id" });

        results.push({ 
          company_number, 
          success: !bulkUpsertError, 
          error: bulkUpsertError?.message 
        });
      }

      return new Response(
        JSON.stringify({ results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
