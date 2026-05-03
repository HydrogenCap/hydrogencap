import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createLogger, withInvocationLog } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const MAX_DOCS_PER_INVOCATION = 100;
const CONCURRENCY = 3;
const SIGNED_URL_TTL_SECONDS = 600;

interface DocRow {
  id: string;
  org_id: string;
  property_id: string | null;
  file_url: string;
}

async function generateSignedUrl(
  supabase: ReturnType<typeof createClient>,
  fileUrl: string,
): Promise<string | null> {
  // file_url stored as a storage object key (org_id/.../file.pdf) — use the
  // 'documents' bucket where the Vault uploads land.
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(fileUrl, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    // Fallback: try the legacy compliance-documents bucket
    const { data: data2 } = await supabase.storage
      .from("compliance-documents")
      .createSignedUrl(fileUrl, SIGNED_URL_TTL_SECONDS);
    return data2?.signedUrl ?? null;
  }
  return data.signedUrl;
}

Deno.serve(withInvocationLog("reprocess-vault-documents", async (req, _invocationLog) => {
  const log = createLogger("reprocess-vault-documents", req);
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claims, error: claimsError } = await userClient.auth.getUser();
    if (claimsError || !claims?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log.withUser(claims.user.id);

    const rate = await checkRateLimit(claims.user.id, "reprocess-vault-documents", 5, 60);
    if (!rate.allowed) return rateLimitResponse(corsHeaders, rate.remaining, rate.resetAt);

    // Fetch failed/pending docs visible to this user (RLS via userClient).
    // We re-queue: extraction_status in ('failed','pending') AND created_at older than 1 hour
    // (avoid stomping on in-flight uploads).
    const { data: docs, error: docsError } = await userClient
      .from("documents")
      .select("id, org_id, property_id, file_url")
      .in("extraction_status", ["failed", "pending"])
      .lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .is("deleted_at", null)
      .not("file_url", "is", null)
      .limit(MAX_DOCS_PER_INVOCATION);

    if (docsError) {
      log.error("Failed to fetch documents", { error: docsError.message });
      return new Response(JSON.stringify({ error: docsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const queue = (docs ?? []) as DocRow[];
    log.info("Reprocess queue built", { count: queue.length });

    if (queue.length === 0) {
      return new Response(
        JSON.stringify({ requeued: 0, succeeded: 0, failed: 0, total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () =>
      (async () => {
        while (queue.length > 0) {
          const doc = queue.shift();
          if (!doc) break;

          try {
            const signedUrl = await generateSignedUrl(adminClient, doc.file_url);
            if (!signedUrl) {
              throw new Error("Could not create signed URL");
            }

            const invokeRes = await fetch(`${supabaseUrl}/functions/v1/process-document-v2`, {
              method: "POST",
              headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
                apikey: supabaseAnonKey,
              },
              body: JSON.stringify({
                document_id: doc.id,
                document_url: signedUrl,
                org_id: doc.org_id,
                ...(doc.property_id ? { property_id: doc.property_id } : {}),
              }),
            });

            if (!invokeRes.ok) {
              const errText = await invokeRes.text().catch(() => "");
              throw new Error(`process-document-v2 ${invokeRes.status}: ${errText.slice(0, 200)}`);
            }
            succeeded++;
          } catch (e) {
            failed++;
            const msg = e instanceof Error ? e.message : String(e);
            errors.push({ id: doc.id, error: msg });
            log.error("Reprocess failed", { id: doc.id, error: msg });
          }
        }
      })(),
    );

    await Promise.all(workers);

    return new Response(
      JSON.stringify({
        requeued: succeeded + failed,
        succeeded,
        failed,
        total: succeeded + failed,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    log.error("reprocess-vault-documents fatal", {
      error: err instanceof Error ? err.message : String(err),
    });
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
