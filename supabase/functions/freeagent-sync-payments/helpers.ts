/**
 * Testable helpers extracted from the freeagent-sync-payments handler:
 *   - AES-GCM encrypt/decrypt of OAuth tokens (keyed by COMPANY_SECRETS_KEY)
 *   - getValidToken: refresh-token flow with db write-back
 *   - getOrCreateContact: FreeAgent contact lookup + create
 *
 * The handler body (V1/V2 property + rent payment sync) is still in index.ts.
 * Testing it would require mocking ~10 tables of queries; these three helpers
 * are the ones with real business/security consequences.
 */

// ── Crypto ──────────────────────────────────────────────────────────

/** Derive a 256-bit AES-GCM key from a passphrase via SHA-256. */
export async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(passphrase));
  return crypto.subtle.importKey("raw", hashBuffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Decrypt a base64-encoded AES-GCM ciphertext (12-byte IV prefix). */
export async function decryptWithKey(ciphertext: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

/** Encrypt a plaintext and return base64(IV || ciphertext). */
export async function encryptWithKey(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const encryptedBytes = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + encryptedBytes.length);
  combined.set(iv);
  combined.set(encryptedBytes, iv.length);
  return btoa(String.fromCharCode(...combined));
}

// ── Token refresh ───────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
export type SupabaseLike = { from: (table: string) => any };
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface FreeAgentConnection {
  id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  use_sandbox: boolean;
}

export interface GetValidTokenDeps {
  supabase: SupabaseLike;
  fetch: FetchLike;
  key: CryptoKey;
  clientId: string;
  clientSecret: string;
  now?: Date;
}

/**
 * Return a valid FreeAgent access token, refreshing it if the stored token
 * expires in the next 5 minutes. On refresh, encrypt and persist the new
 * tokens back to freeagent_connections.
 */
export async function getValidToken(
  connection: FreeAgentConnection,
  deps: GetValidTokenDeps,
): Promise<string> {
  const now = deps.now ?? new Date();
  const expiresAt = new Date(connection.token_expires_at);

  if (expiresAt > new Date(now.getTime() + 5 * 60000)) {
    return await decryptWithKey(connection.access_token_encrypted, deps.key);
  }

  const apiBase = connection.use_sandbox
    ? "https://api.sandbox.freeagent.com"
    : "https://api.freeagent.com";

  const refreshToken = await decryptWithKey(connection.refresh_token_encrypted, deps.key);

  const response = await deps.fetch(`${apiBase}/v2/token_endpoint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${deps.clientId}:${deps.clientSecret}`)}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });

  if (!response.ok) {
    throw new Error(`FreeAgent token refresh failed: ${response.status}`);
  }

  const tokens = await response.json();
  const newExpiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

  await deps.supabase
    .from("freeagent_connections")
    .update({
      access_token_encrypted: await encryptWithKey(tokens.access_token, deps.key),
      refresh_token_encrypted: await encryptWithKey(tokens.refresh_token, deps.key),
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return tokens.access_token;
}

// ── FreeAgent contact lookup/create ─────────────────────────────────

export interface FreeAgentContact {
  url: string;
  first_name?: string;
  last_name?: string;
  organisation_name?: string | null;
}

/**
 * Look up a FreeAgent contact by name; create one if none matches.
 * Returns the contact's URL (used as the FK on invoices/transactions).
 */
export async function getOrCreateContact(
  apiBase: string,
  accessToken: string,
  tenantName: string,
  tenantEmail: string | null,
  propertyAddress: string,
  fetchImpl: FetchLike,
): Promise<string> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const listRes = await fetchImpl(`${apiBase}/v2/contacts?view=active&per_page=100`, { headers });

  if (listRes.ok) {
    const listData = await listRes.json();
    const contacts: FreeAgentContact[] = listData.contacts || [];
    const nameParts = tenantName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const existing = contacts.find((c) =>
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

  const createRes = await fetchImpl(`${apiBase}/v2/contacts`, {
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
