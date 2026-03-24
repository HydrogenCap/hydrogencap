import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return Response.redirect(`${APP_URL}/settings?tab=integrations&freeagent=error&code=missing_params`, 302);
  }

  try {
    const stateData = JSON.parse(atob(state));
    const { entityId, companyId, orgId, userId, useSandbox, nonce } = stateData;

    // Validate required state fields to prevent forged states
    if (!orgId || !userId || !nonce) {
      return Response.redirect(`${APP_URL}/settings?tab=integrations&freeagent=error&code=invalid_state`, 302);
    }

    // Verify the userId from state is an owner/admin in the target org
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: membership } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("org_id", orgId)
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (!membership) {
      console.error("OAuth CSRF check failed: userId not authorized for orgId");
      return Response.redirect(`${APP_URL}/settings?tab=integrations&freeagent=error&code=unauthorized`, 302);
    }

    if (entityId) {
      const { data: entity } = await supabase
        .from("legal_entities")
        .select("id, org_id")
        .eq("id", entityId)
        .maybeSingle();

      if (!entity || entity.org_id !== orgId) {
        return Response.redirect(`${APP_URL}/settings?tab=integrations&freeagent=error&code=invalid_target`, 302);
      }
    }

    if (companyId) {
      const { data: company } = await supabase
        .from("companies")
        .select("id, org_id")
        .eq("id", companyId)
        .maybeSingle();

      if (!company || company.org_id !== orgId) {
        return Response.redirect(`${APP_URL}/settings?tab=integrations&freeagent=error&code=invalid_target`, 302);
      }
    }

    const apiBase = useSandbox ? "https://api.sandbox.freeagent.com" : "https://api.freeagent.com";
    const redirectUri = `${SUPABASE_URL}/functions/v1/freeagent-oauth-callback`;

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
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      console.error("FreeAgent token exchange failed:", tokenResponse.status);
      return Response.redirect(`${APP_URL}/settings?tab=integrations&freeagent=error&code=token_exchange`, 302);
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

    // Bridge: find the V1 company_id via company_number matching
    let resolvedCompanyId = companyId || null;
    if (entityId && !resolvedCompanyId) {
      const { data: entity } = await supabase
        .from("legal_entities")
        .select("company_number")
        .eq("id", entityId)
        .single();

      if (entity?.company_number) {
        const { data: v1Company } = await supabase
          .from("companies")
          .select("id")
          .eq("company_number", entity.company_number)
          .eq("org_id", orgId)
          .maybeSingle();

        resolvedCompanyId = v1Company?.id || null;
      }
    }

    const upsertData: Record<string, any> = {
      org_id: orgId,
      company_id: resolvedCompanyId || entityId,
      entity_id: entityId || null,
      freeagent_company_name: freeagentCompanyName,
      freeagent_company_url: freeagentCompanyUrl,
      access_token_encrypted: accessTokenEnc,
      refresh_token_encrypted: refreshTokenEnc,
      token_expires_at: expiresAt,
      use_sandbox: useSandbox || false,
      connected_by: userId,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("freeagent_connections")
      .upsert(upsertData, { onConflict: "org_id,company_id" });

    if (upsertError) {
      console.error("DB upsert failed:", upsertError.message);
      return Response.redirect(`${APP_URL}/settings?tab=integrations&freeagent=error&code=db_error`, 302);
    }

    return Response.redirect(
      `${APP_URL}/settings?tab=integrations&freeagent=connected&entity=${entityId || companyId}`,
      302
    );
  } catch (error: any) {
    console.error("FreeAgent OAuth callback error:", error.message);
    return Response.redirect(`${APP_URL}/settings?tab=integrations&freeagent=error&code=unexpected`, 302);
  }
});
