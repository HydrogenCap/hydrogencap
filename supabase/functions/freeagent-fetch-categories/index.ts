import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FREEAGENT_CLIENT_ID = Deno.env.get("FREEAGENT_CLIENT_ID")!;
const FREEAGENT_CLIENT_SECRET = Deno.env.get("FREEAGENT_CLIENT_SECRET")!;

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

async function getKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get("COMPANY_SECRETS_KEY")!;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(keyString));
  return crypto.subtle.importKey("raw", hashBuffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function decrypt(ciphertext: string): Promise<string> {
  const key = await getKey();
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function getValidToken(connection: any, supabase: any): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(connection.token_expires_at);

  if (expiresAt > new Date(now.getTime() + 5 * 60000)) {
    return await decrypt(connection.access_token_encrypted);
  }

  const apiBase = connection.use_sandbox ? "https://api.sandbox.freeagent.com" : "https://api.freeagent.com";
  const refreshToken = await decrypt(connection.refresh_token_encrypted);

  const response = await fetch(`${apiBase}/v2/token_endpoint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${FREEAGENT_CLIENT_ID}:${FREEAGENT_CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`FreeAgent token refresh failed: ${response.status}`);
  }

  const tokens = await response.json();
  const newExpiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

  await supabase
    .from("freeagent_connections")
    .update({
      access_token_encrypted: await encrypt(tokens.access_token),
      refresh_token_encrypted: await encrypt(tokens.refresh_token),
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return tokens.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json();
    const { entityId, companyId: legacyCompanyId } = body;

    // Look up connection by entity_id or company_id
    let connection: any;
    let connError: any;

    if (entityId) {
      const result = await supabase
        .from("freeagent_connections")
        .select("*")
        .eq("entity_id", entityId)
        .single();
      connection = result.data;
      connError = result.error;
    } else if (legacyCompanyId) {
      const result = await supabase
        .from("freeagent_connections")
        .select("*")
        .eq("company_id", legacyCompanyId)
        .single();
      connection = result.data;
      connError = result.error;
    }

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: "No FreeAgent connection" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiBase = connection.use_sandbox
      ? "https://api.sandbox.freeagent.com"
      : "https://api.freeagent.com";

    const accessToken = await getValidToken(connection, supabase);
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    };

    const categoriesRes = await fetch(`${apiBase}/v2/categories`, { headers });
    const categoriesData = categoriesRes.ok ? await categoriesRes.json() : {};

    const bankRes = await fetch(`${apiBase}/v2/bank_accounts`, { headers });
    const bankData = bankRes.ok ? await bankRes.json() : {};

    return new Response(JSON.stringify({
      categories: categoriesData.categories || [],
      bank_accounts: (bankData.bank_accounts || []).map((ba: any) => ({
        url: ba.url,
        name: ba.name,
        type: ba.type,
        currency: ba.currency,
        opening_balance: ba.opening_balance,
      })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
