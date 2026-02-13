import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FREEAGENT_CLIENT_ID = Deno.env.get("FREEAGENT_CLIENT_ID")!;
const FREEAGENT_CLIENT_SECRET = Deno.env.get("FREEAGENT_CLIENT_SECRET")!;
const APP_URL = Deno.env.get("APP_URL") || "https://hydrogencapital.lovable.app";

async function getKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get("COMPANY_SECRETS_KEY")!;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);
  return crypto.subtle.importKey("raw", hashBuffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext));
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  try {
    const stateData = JSON.parse(atob(state));
    const { companyId, orgId, userId, useSandbox } = stateData;

    const apiBase = useSandbox ? "https://api.sandbox.freeagent.com" : "https://api.freeagent.com";

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(`${apiBase}/v2/token_endpoint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${FREEAGENT_CLIENT_ID}:${FREEAGENT_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${SUPABASE_URL}/functions/v1/freeagent-oauth-callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error("FreeAgent token exchange failed:", err);
      return Response.redirect(`${APP_URL}/settings?tab=integrations&freeagent=error&msg=token_exchange_failed`, 302);
    }

    const tokens = await tokenResponse.json();

    // Get FreeAgent company info
    const companyResponse = await fetch(`${apiBase}/v2/company`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: "application/json",
      },
    });

    let freeagentCompanyName = null;
    let freeagentCompanyUrl = null;
    if (companyResponse.ok) {
      const companyData = await companyResponse.json();
      freeagentCompanyName = companyData.company?.name || null;
      freeagentCompanyUrl = companyData.company?.url || null;
    }

    // Encrypt tokens
    const accessTokenEnc = await encrypt(tokens.access_token);
    const refreshTokenEnc = await encrypt(tokens.refresh_token);
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    // Store connection
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { error: upsertError } = await supabase
      .from("freeagent_connections")
      .upsert({
        org_id: orgId,
        company_id: companyId,
        freeagent_company_name: freeagentCompanyName,
        freeagent_company_url: freeagentCompanyUrl,
        access_token_encrypted: accessTokenEnc,
        refresh_token_encrypted: refreshTokenEnc,
        token_expires_at: expiresAt,
        use_sandbox: useSandbox || false,
        connected_by: userId,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "org_id,company_id" });

    if (upsertError) {
      console.error("DB upsert failed:", upsertError);
      return Response.redirect(`${APP_URL}/settings?tab=integrations&freeagent=error&msg=db_error`, 302);
    }

    return Response.redirect(`${APP_URL}/settings?tab=integrations&freeagent=connected&company=${companyId}`, 302);
  } catch (error: any) {
    console.error("FreeAgent OAuth callback error:", error);
    return Response.redirect(`${APP_URL}/settings?tab=integrations&freeagent=error&msg=${encodeURIComponent(error.message)}`, 302);
  }
});
