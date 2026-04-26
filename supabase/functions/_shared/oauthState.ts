/**
 * HMAC-SHA256 signed OAuth state tokens with replay protection support.
 *
 * Format: base64url(JSON(payload)) + "." + base64url(HMAC-SHA256(body))
 *
 * The signing secret is read from FREEAGENT_STATE_SECRET. Rotating the secret
 * invalidates all in-flight OAuth states.
 *
 * Pure / runtime-agnostic: relies only on Web Crypto + globalThis, so the
 * module works in Deno edge functions, Node 20+, and browsers.
 */

export interface OAuthStatePayload {
  orgId: string;
  userId: string;
  entityId?: string;
  companyId?: string;
  useSandbox?: boolean;
  nonce: string;
  /** Unix epoch milliseconds at which the token expires. */
  exp: number;
  [k: string]: unknown;
}

export class OAuthStateError extends Error {
  code: "missing_secret" | "bad_format" | "bad_signature" | "expired" | "bad_payload";
  constructor(code: OAuthStateError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "OAuthStateError";
  }
}

function getSecret(): string {
  // Deno first, then Node/process for test environments.
  const denoEnv = (globalThis as any).Deno?.env?.get?.("FREEAGENT_STATE_SECRET");
  const nodeEnv =
    typeof process !== "undefined" ? (process as any).env?.FREEAGENT_STATE_SECRET : undefined;
  const secret = denoEnv ?? nodeEnv;
  if (!secret || typeof secret !== "string" || secret.length === 0) {
    throw new OAuthStateError(
      "missing_secret",
      "FREEAGENT_STATE_SECRET is not configured",
    );
  }
  return secret;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function hmac(secret: string, body: string): Promise<Uint8Array> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return new Uint8Array(sig);
}

/** Constant-time byte comparison. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Sign an OAuth state payload and return a `body.sig` token. */
export async function signState(payload: OAuthStatePayload): Promise<string> {
  if (
    !payload ||
    typeof payload.orgId !== "string" ||
    typeof payload.userId !== "string" ||
    typeof payload.nonce !== "string" ||
    typeof payload.exp !== "number"
  ) {
    throw new OAuthStateError("bad_payload", "Invalid OAuth state payload shape");
  }
  const secret = getSecret();
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sigBytes = await hmac(secret, body);
  const sig = b64urlEncode(sigBytes);
  return `${body}.${sig}`;
}

/** Verify a signed state token and return the parsed payload. */
export async function verifyState(state: string): Promise<OAuthStatePayload> {
  if (typeof state !== "string" || state.length === 0) {
    throw new OAuthStateError("bad_format", "OAuth state token is empty");
  }
  const dot = state.indexOf(".");
  if (dot <= 0 || dot === state.length - 1) {
    throw new OAuthStateError("bad_format", "OAuth state token is malformed");
  }
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);

  const secret = getSecret();
  let providedSig: Uint8Array;
  try {
    providedSig = b64urlDecode(sig);
  } catch {
    throw new OAuthStateError("bad_signature", "OAuth state signature is not valid base64url");
  }
  const expectedSig = await hmac(secret, body);
  if (!timingSafeEqual(providedSig, expectedSig)) {
    throw new OAuthStateError("bad_signature", "OAuth state signature does not match");
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(dec.decode(b64urlDecode(body)));
  } catch {
    throw new OAuthStateError("bad_payload", "OAuth state payload is not valid JSON");
  }
  if (
    !payload ||
    typeof payload.orgId !== "string" ||
    typeof payload.userId !== "string" ||
    typeof payload.nonce !== "string" ||
    typeof payload.exp !== "number"
  ) {
    throw new OAuthStateError("bad_payload", "OAuth state payload shape is invalid");
  }
  if (payload.exp <= Date.now()) {
    throw new OAuthStateError("expired", "OAuth state token has expired");
  }
  return payload;
}
