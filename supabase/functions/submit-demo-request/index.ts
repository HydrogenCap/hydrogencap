// Public marketing demo-request submission endpoint.
//
// This function intentionally accepts unauthenticated requests because it powers
// the public marketing form (matching the existing "Anyone can submit demo
// requests" RLS policy on demo_requests). On top of that public-ingest design it
// adds three abuse controls:
//   1. Honeypot field — if the "website" field is filled, the submission is
//      silently dropped (200 OK with success body, but no row inserted).
//   2. IP-based rate limit — at most 5 submissions per hour for the same hashed
//      client IP. The hash uses a server-side salt so raw IPs are never stored.
//   3. Server-side email format + length validation via Zod.
//
// The matching email-based rate limit (5/hour per email) is enforced as a
// database trigger so it cannot be bypassed even if a caller hits the table
// through the Data API directly.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders } from "../_shared/cors.ts";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(40).optional().nullable(),
  company: z.string().trim().max(200).optional().nullable(),
  message: z.string().trim().max(4000).optional().nullable(),
  // Honeypot — real users never see / fill this. Bots typically auto-fill all
  // inputs. If present and non-empty, we drop the request silently.
  website: z.string().optional().nullable(),
});

// In-memory IP rate limit. Edge function instances are short-lived but this
// catches the common case of a single bot hammering one instance. The
// email-side trigger on the DB is the durable backstop.
const ipHits = new Map<string, number[]>();
const IP_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const IP_RATE_MAX = 5;

async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get("DEMO_IP_HASH_SALT") ?? "demo-requests-default-salt";
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function checkIpRateLimit(ipHash: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ipHash) ?? []).filter((t) => now - t < IP_RATE_WINDOW_MS);
  if (hits.length >= IP_RATE_MAX) {
    ipHits.set(ipHash, hits);
    return false;
  }
  hits.push(now);
  ipHits.set(ipHash, hits);
  return true;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const data = parsed.data;

    // Honeypot — silently succeed so bots don't probe for the signal.
    if (data.website && data.website.trim().length > 0) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IP-based rate limit (hashed, never stores raw IP).
    const ipHash = await hashIp(getClientIp(req));
    if (!checkIpRateLimit(ipHash)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { error } = await supabase.from("demo_requests").insert({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      company: data.company || null,
      message: data.message || null,
    });

    if (error) {
      // Email-based rate limit raises a check_violation with this marker.
      if (error.message.includes("demo_request_rate_limit_exceeded")) {
        return new Response(
          JSON.stringify({ error: "Too many requests for this email. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      console.error("demo_requests insert failed", error);
      return new Response(JSON.stringify({ error: "Could not submit request" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("submit-demo-request error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
