/**
 * Testable core of the ai-gap-fill edge function.
 *
 * No top-level esm.sh imports or dependency on Deno.env — everything the
 * handler needs is injected via `deps`. `index.ts` owns the Deno runtime
 * wiring (CORS, env, real clients, AI API key).
 */

// deno-lint-ignore no-explicit-any
export type SupabaseLike = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: string;
}

export interface SubscriptionAllowResult { allowed: true }
export interface SubscriptionDenyResult { allowed: false; response: Response }
export type SubscriptionResult = SubscriptionAllowResult | SubscriptionDenyResult;

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface HandleAiGapFillDeps {
  supabase: SupabaseLike;
  checkRateLimit: (userId: string, fnName: string, max: number, windowMinutes: number) => Promise<RateLimitResult>;
  rateLimitResponse: (corsHeaders: Record<string, string>, remaining: number, resetAt: string) => Response;
  requireActiveSubscription: (userId: string, corsHeaders: Record<string, string>) => Promise<SubscriptionResult>;
  fetch: FetchLike;
  corsHeaders: Record<string, string>;
  lovableApiKey: string | undefined;
}

// ── Prompt builders (pure, exported for tests) ──────────────────────

const PROPERTY_SYSTEM_PROMPT = `You are a UK property data expert. Given a list of properties with some missing fields, suggest realistic values based on the address, postcode, and any existing data.

Rules:
- council_name: The local authority responsible for the area (e.g. "Birmingham City Council")
- council_area: The broader area/county (e.g. "West Midlands")
- year_built: Estimate based on address, area character, and postcode. Use your knowledge of UK housing stock.
- has_gas_supply: Most UK properties have gas. Default true unless the area is known for off-grid properties.
- total_floors: Estimate based on property type if known
- Do NOT guess financial values (current_valuation, purchase_price) - leave those null
- Only suggest values for fields that are currently null

Return a JSON array of objects with id and only the fields you can fill. Do not include fields you cannot reasonably estimate.`;

const ROOM_SYSTEM_PROMPT = `You are a UK property rental expert. Given a list of rooms with some missing fields, suggest realistic values.

Rules:
- target_rent_pcm: If current_rent_pcm exists, suggest target as current + 5-10% rounded to nearest £25
- floor: Default to 0 (ground floor) for single-storey, or estimate based on room name
- Do NOT guess has_ensuite - leave null if unknown
- Only suggest values for fields that are currently null

Return a JSON array of objects with id and only the fields you can fill.`;

// deno-lint-ignore no-explicit-any
export function buildPrompt(type: string, records: any[]): { systemPrompt: string; userPrompt: string } | null {
  if (type === "properties") {
    const simplified = records.map((r) => ({
      id: r.id,
      address: r.address_line_1,
      postcode: r.postcode,
      property_type: r.property_type,
      has_gas_supply: r.has_gas_supply,
      year_built: r.year_built,
      total_floors: r.total_floors,
      council_name: r.council_name,
      council_area: r.council_area,
    }));
    return {
      systemPrompt: PROPERTY_SYSTEM_PROMPT,
      userPrompt: `Here are properties with missing data (null values need filling):\n\n${JSON.stringify(simplified, null, 2)}`,
    };
  }

  if (type === "rooms") {
    const simplified = records.map((r) => ({
      id: r.id,
      room_name: r.room_name,
      property_address: r.property_address,
      room_type: r.room_type,
      current_rent_pcm: r.current_rent_pcm,
      target_rent_pcm: r.target_rent_pcm,
      floor: r.floor,
    }));
    return {
      systemPrompt: ROOM_SYSTEM_PROMPT,
      userPrompt: `Here are rooms with missing data:\n\n${JSON.stringify(simplified, null, 2)}`,
    };
  }

  return null;
}

// ── Handler ─────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleAiGapFill(req: Request, deps: HandleAiGapFillDeps): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: deps.corsHeaders });
  }

  try {
    // 1. Auth — header check + token exchange.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401, deps.corsHeaders);
    }
    const { data: userData, error: authError } = await deps.supabase.auth.getUser();
    if (authError || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401, deps.corsHeaders);
    }
    const userId = userData.user.id;

    // 2. Subscription gate.
    const subCheck = await deps.requireActiveSubscription(userId, deps.corsHeaders);
    if (!subCheck.allowed) return subCheck.response;

    // 3. Rate limit gate.
    const rateLimit = await deps.checkRateLimit(userId, "ai-gap-fill", 20, 60);
    if (!rateLimit.allowed) {
      return deps.rateLimitResponse(deps.corsHeaders, rateLimit.remaining, rateLimit.resetAt);
    }

    if (!deps.lovableApiKey) throw new Error("LOVABLE_API_KEY is not configured");

    // 4. Request body validation.
    const body = await req.json();
    const { type, records } = body as { type?: string; records?: unknown[] };

    if (!type || !records?.length) {
      return jsonResponse({ error: "type and records are required" }, 400, deps.corsHeaders);
    }

    const prompt = buildPrompt(type, records);
    if (!prompt) {
      return jsonResponse(
        { error: 'Unsupported type. Use "properties" or "rooms".' },
        400,
        deps.corsHeaders,
      );
    }

    // 5. AI gateway call.
    const response = await deps.fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deps.lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: prompt.systemPrompt },
          { role: "user", content: prompt.userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_gap_fills",
              description: "Return suggested values for missing fields",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "Record UUID" },
                        council_name: { type: "string" },
                        council_area: { type: "string" },
                        year_built: { type: "number" },
                        has_gas_supply: { type: "boolean" },
                        total_floors: { type: "number" },
                        target_rent_pcm: { type: "number" },
                        floor: { type: "number" },
                      },
                      required: ["id"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_gap_fills" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return jsonResponse({ error: "Rate limit exceeded, please try again later." }, 429, deps.corsHeaders);
      }
      if (response.status === 402) {
        return jsonResponse({ error: "Usage limit reached. Please add credits." }, 402, deps.corsHeaders);
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No suggestions returned from AI");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    return jsonResponse({ suggestions: parsed.suggestions }, 200, deps.corsHeaders);
  } catch (e) {
    console.error("ai-gap-fill error:", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
      deps.corsHeaders,
    );
  }
}
