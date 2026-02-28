import { z } from "https://esm.sh/zod@3.23.8";

/**
 * Validate request body against a Zod schema.
 * Returns the parsed data or a 400 Response.
 */
export async function validateBody<T extends z.ZodType>(
  req: Request,
  schema: T,
  corsHeaders: Record<string, string>
): Promise<{ data: z.infer<T> } | { error: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      error: new Response(
        JSON.stringify({
          error: "Invalid JSON body",
          details: "Request body must be valid JSON",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    return {
      error: new Response(
        JSON.stringify({
          error: "Validation failed",
          details: issues,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  return { data: result.data };
}
