import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function getOrCreateContact(
  apiBase: string,
  accessToken: string,
  tenantName: string,
  tenantEmail: string | null,
  propertyAddress: string
): Promise<string> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const listRes = await fetch(`${apiBase}/v2/contacts?view=active&per_page=100`, { headers });

  if (listRes.ok) {
    const listData = await listRes.json();
    const contacts = listData.contacts || [];

    const nameParts = tenantName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const existing = contacts.find((c: any) =>
      (c.first_name === firstName && c.last_name === lastName) ||
      c.organisation_name === tenantName
    );
    if (existing) {
      return existing.url;
    }
  }

  const nameParts = tenantName.split(" ");
  const contactBody = {
    contact: {
      first_name: nameParts[0],
      last_name: nameParts.slice(1).join(" "),
      email: tenantEmail,
      address1: propertyAddress,
      country: "United Kingdom",
      status: "Active",
      charge_sales_tax: "Auto",
    },
  };

  const createRes = await fetch(`${apiBase}/v2/contacts`, {
    method: "POST",
    headers,
    body: JSON.stringify(contactBody),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create FreeAgent contact: ${err}`);
  }

  const createData = await createRes.json();
  return createData.contact.url;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json();
    const { entityId, companyId: legacyCompanyId } = body;

    if (!entityId && !legacyCompanyId) {
      return new Response(JSON.stringify({ error: "entityId or companyId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up connection by entity_id or company_id
    let connection: any;
    let connErr: any;

    if (entityId) {
      const result = await supabase
        .from("freeagent_connections")
        .select("*")
        .eq("entity_id", entityId)
        .single();
      connection = result.data;
      connErr = result.error;
    } else {
      const result = await supabase
        .from("freeagent_connections")
        .select("*")
        .eq("company_id", legacyCompanyId)
        .single();
      connection = result.data;
      connErr = result.error;
    }

    if (connErr || !connection) {
      return new Response(JSON.stringify({ error: "No FreeAgent connection found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!connection.sync_rent_payments) {
      return new Response(JSON.stringify({ error: "Rent payment sync disabled" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // V2-first property lookup with V1 fallback
    let propertyIds: string[] = [];
    const propertyMap = new Map<string, string>(); // id -> address

    if (connection.entity_id) {
      const { data: v2Props } = await supabase
        .from("properties_v2")
        .select("id, address_line_1, city, postcode, entity_id")
        .eq("entity_id", connection.entity_id);

      if (v2Props?.length) {
        propertyIds = v2Props.map((p: any) => p.id);
        v2Props.forEach((p: any) => propertyMap.set(p.id, `${p.address_line_1}${p.city ? ', ' + p.city : ''}`));
      }
    }

    // V1 fallback if no V2 properties found
    if (propertyIds.length === 0) {
      let v1CompanyId = connection.company_id;

      if (!v1CompanyId && connection.entity_id) {
        const { data: entity } = await supabase
          .from("legal_entities")
          .select("company_number")
          .eq("id", connection.entity_id)
          .single();

        if (entity?.company_number) {
          const { data: v1Company } = await supabase
            .from("companies")
            .select("id")
            .eq("company_number", entity.company_number)
            .eq("org_id", connection.org_id)
            .maybeSingle();

          v1CompanyId = v1Company?.id || null;
        }
      }

      if (v1CompanyId) {
        const { data: v1Props } = await supabase
          .from("properties")
          .select("id, address_line, postcode")
          .eq("company_id", v1CompanyId);

        if (v1Props?.length) {
          propertyIds = v1Props.map((p: any) => p.id);
          v1Props.forEach((p: any) => propertyMap.set(p.id, p.address_line || ''));
        }
      }
    }

    if (propertyIds.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: "No properties found for this entity" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get rent payments for these properties (V1 data)
    const { data: payments, error: paymentsErr } = await supabase
      .from("rent_payments")
      .select(`
        *,
        tenancy:tenancies(
          id, property_id, rent_amount_pcm,
          tenant:tenants(id, first_name, last_name, email),
          room:rooms(room_name),
          property:properties(id, address_line, postcode, company_id)
        )
      `)
      .eq("org_id", connection.org_id)
      .order("payment_date", { ascending: true });

    if (paymentsErr) throw paymentsErr;

    // Filter to payments for this company's properties
    const companyPayments = (payments || []).filter((p: any) => {
      const propId = p.tenancy?.property?.id;
      return propId && propertyIds.includes(propId);
    });

    // Check which have already been synced
    const paymentIds = companyPayments.map((p: any) => p.id);
    const { data: existingLogs } = await supabase
      .from("freeagent_sync_log")
      .select("source_id, status")
      .eq("freeagent_connection_id", connection.id)
      .eq("source_table", "rent_payments")
      .in("source_id", paymentIds)
      .eq("status", "synced");

    const syncedIds = new Set((existingLogs || []).map((l: any) => l.source_id));
    const unsyncedPayments = companyPayments.filter((p: any) => !syncedIds.has(p.id));

    if (unsyncedPayments.length === 0) {
      await supabase.from("freeagent_connections").update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "success",
        last_sync_error: null,
        last_sync_items_count: 0,
      }).eq("id", connection.id);

      return new Response(JSON.stringify({ synced: 0, message: "All payments already synced" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let syncedCount = 0;
    let failedCount = 0;

    for (const payment of unsyncedPayments.slice(0, 50)) {
      try {
        const tenancy = payment.tenancy as any;
        const tenant = tenancy?.tenant;
        const property = tenancy?.property;
        const roomName = tenancy?.room?.room_name || "";

        if (!tenant || !property) {
          await supabase.from("freeagent_sync_log").upsert({
            org_id: connection.org_id,
            freeagent_connection_id: connection.id,
            source_table: "rent_payments",
            source_id: payment.id,
            status: "skipped",
            error_message: "Missing tenant or property data",
            synced_at: new Date().toISOString(),
          }, { onConflict: "freeagent_connection_id,source_table,source_id" });
          continue;
        }

        const tenantName = `${tenant.first_name} ${tenant.last_name}`;
        const address = property.address_line;
        const description = `Rent payment${roomName ? ` — ${roomName}` : ""} — ${address}`;

        const contactUrl = await getOrCreateContact(apiBase, accessToken, tenantName, tenant.email, address);

        const invoiceBody: any = {
          invoice: {
            contact: contactUrl,
            dated_on: payment.payment_date,
            payment_terms_in_days: 0,
            reference: payment.reference || `RENT-${payment.id.slice(0, 8)}`,
            comments: `HydrogenCap rent sync — ${address}`,
            invoice_items: [{
              description,
              item_type: "Services",
              quantity: 1.0,
              price: payment.amount,
              ...(connection.rent_income_category_url ? {
                category: connection.rent_income_category_url,
              } : {}),
            }],
          },
        };

        const invoiceRes = await fetch(`${apiBase}/v2/invoices`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(invoiceBody),
        });

        if (!invoiceRes.ok) {
          const err = await invoiceRes.text();
          throw new Error(`Invoice creation failed: ${err}`);
        }

        const invoiceData = await invoiceRes.json();
        const invoiceUrl = invoiceData.invoice?.url;

        if (invoiceUrl) {
          await fetch(`${invoiceUrl}/transitions/mark_as_sent`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          });

          if (connection.bank_account_url) {
            await fetch(`${invoiceUrl}/transitions/mark_as_paid`, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                invoice: {
                  paid_on: payment.payment_date,
                  paid_value: String(payment.amount),
                  bank_account: connection.bank_account_url,
                },
              }),
            });
          }
        }

        await supabase.from("freeagent_sync_log").upsert({
          org_id: connection.org_id,
          freeagent_connection_id: connection.id,
          source_table: "rent_payments",
          source_id: payment.id,
          freeagent_invoice_url: invoiceUrl,
          freeagent_contact_url: contactUrl,
          status: "synced",
          synced_at: new Date().toISOString(),
        }, { onConflict: "freeagent_connection_id,source_table,source_id" });

        syncedCount++;

        // Rate limit: 2s delay between payments
        await new Promise(r => setTimeout(r, 2000));
      } catch (paymentErr: any) {
        failedCount++;
        await supabase.from("freeagent_sync_log").upsert({
          org_id: connection.org_id,
          freeagent_connection_id: connection.id,
          source_table: "rent_payments",
          source_id: payment.id,
          status: "failed",
          error_message: paymentErr.message,
          synced_at: new Date().toISOString(),
        }, { onConflict: "freeagent_connection_id,source_table,source_id" });
      }
    }

    await supabase.from("freeagent_connections").update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: failedCount === 0 ? "success" : syncedCount > 0 ? "partial" : "failed",
      last_sync_error: failedCount > 0 ? `${failedCount} payments failed to sync` : null,
      last_sync_items_count: syncedCount,
    }).eq("id", connection.id);

    return new Response(
      JSON.stringify({ synced: syncedCount, failed: failedCount, remaining: unsyncedPayments.length - syncedCount - failedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("FreeAgent sync error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
