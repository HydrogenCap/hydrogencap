import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { validateBody } from "../_shared/validate.ts";
import { requireActiveSubscription } from "../_shared/checkSubscription.ts";
import { createLogger } from "../_shared/logger.ts";
import { CHAT_TOOLS } from "./tools.ts";
import { executeTool } from "./tool-executor.ts";

const ALLOWED_ORIGINS = [
  "https://tenureiq.com",
  "https://www.tenureiq.com",
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE, PATCH",
  };
}

interface ToolCallResult {
  tool_call_id: string;
  name: string;
  content: string;
}

const SYSTEM_PROMPT = `You are TenureIQ AI, an intelligent assistant for UK property portfolio management.

You have access to tools that let you query the user's real portfolio data, create tasks, generate reports, and set reminders. Always use tools to get current data — never guess.

Guidelines:
- Use British English and UK property terminology
- Format currency as GBP (£), dates as DD/MM/YYYY
- When the user asks about their portfolio, use search_properties or calculate_portfolio_metrics
- When the user asks about a specific property, use get_property_details
- When the user wants to create a task, use create_compliance_task — but ask for confirmation first
- When the user wants a report, use generate_report
- When the user wants a reminder, use schedule_reminder — but ask for confirmation first
- Flag compliance issues proactively
- Be concise but comprehensive
- When presenting financial data, use tables where appropriate`;

const MAX_TOOL_ROUNDS = 3;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const log = createLogger("portfolio-chat", req);

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    log.withUser(userId);

    // Subscription check
    const subCheck = await requireActiveSubscription(userId, corsHeaders);
    if (!subCheck.allowed) return subCheck.response;

    // Rate limit check
    const rateLimit = await checkRateLimit(userId, "portfolio-chat", 30, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(corsHeaders, rateLimit.remaining, rateLimit.resetAt);
    }

    // --- Route handling ---
    const url = new URL(req.url);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    // Paths: /portfolio-chat/conversations, /portfolio-chat/conversations/:id, /portfolio-chat/conversations/:id/messages, /portfolio-chat (chat)

    // GET /conversations — list conversations
    if (req.method === "GET" && pathSegments.at(-1) === "conversations") {
      return handleListConversations(supabase, userId, corsHeaders);
    }

    // DELETE /conversations/:id
    if (req.method === "DELETE" && pathSegments.at(-2) === "conversations") {
      const convId = pathSegments.at(-1)!;
      return handleDeleteConversation(supabase, convId, corsHeaders);
    }

    // PATCH /conversations/:id — update title
    if (req.method === "PATCH" && pathSegments.at(-2) === "conversations") {
      const convId = pathSegments.at(-1)!;
      const body = await req.json();
      return handleUpdateConversation(supabase, convId, body, corsHeaders);
    }

    // GET /conversations/:id/messages
    if (req.method === "GET" && pathSegments.at(-1) === "messages") {
      const convId = pathSegments.at(-2)!;
      return handleGetMessages(supabase, convId, corsHeaders);
    }

    // POST — chat message (main flow)
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ChatSchema = z.object({
      message: z.string().min(1).max(10000),
      conversation_id: z.string().uuid().optional(),
    });

    const parsed = await validateBody(req, ChatSchema, corsHeaders);
    if ("error" in parsed) return parsed.error;
    const { message, conversation_id } = parsed.data;

    // Resolve org_id
    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "No organization found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = membership.org_id;

    // Get or create conversation
    let conversationId = conversation_id;
    if (!conversationId) {
      const title = message.length > 60 ? message.slice(0, 57) + "..." : message;
      const { data: conv, error: convError } = await supabase
        .from("chat_conversations")
        .insert({ org_id: orgId, user_id: userId, title })
        .select("id")
        .single();
      if (convError) {
        log.error("Failed to create conversation", { error: convError.message });
        return new Response(JSON.stringify({ error: "Failed to create conversation" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      conversationId = conv.id;
    }

    // Load conversation history
    const { data: historyRows } = await supabase
      .from("chat_messages")
      .select("role, content, tool_calls, tool_call_id")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(50);

    const history = (historyRows ?? []).map((row) => {
      const msg: Record<string, unknown> = { role: row.role, content: row.content ?? "" };
      if (row.tool_calls) msg.tool_calls = row.tool_calls;
      if (row.tool_call_id) msg.tool_call_id = row.tool_call_id;
      return msg;
    });

    // Save user message
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: message,
    });

    // Build messages array for AI
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: message },
    ];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      log.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tool-call loop (non-streaming)
    let toolRound = 0;
    const toolCallsExecuted: { name: string; args: Record<string, unknown> }[] = [];

    while (toolRound < MAX_TOOL_ROUNDS) {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
          tools: CHAT_TOOLS,
          stream: false,
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (status === 402) {
          return new Response(
            JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errorText = await aiResponse.text();
        log.error("AI gateway error", { status, errorText });
        return new Response(JSON.stringify({ error: "AI service unavailable" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResponse.json();
      const choice = aiData.choices?.[0];
      if (!choice) {
        log.error("No choices in AI response");
        break;
      }

      const assistantMessage = choice.message;

      // Check for tool calls
      if (assistantMessage.tool_calls?.length > 0) {
        toolRound++;
        log.info("Tool calls received", {
          round: toolRound,
          tools: assistantMessage.tool_calls.map((tc: { function: { name: string } }) => tc.function.name),
        });

        // Add assistant message with tool calls to conversation
        messages.push({
          role: "assistant",
          content: assistantMessage.content ?? "",
          tool_calls: assistantMessage.tool_calls,
        } as Record<string, unknown>);

        // Save assistant tool-call message to DB
        await supabase.from("chat_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: assistantMessage.content ?? null,
          tool_calls: assistantMessage.tool_calls,
        });

        // Execute each tool call
        const toolResults: ToolCallResult[] = [];
        for (const tc of assistantMessage.tool_calls) {
          const toolName = tc.function.name;
          let toolArgs: Record<string, unknown> = {};
          try {
            toolArgs = typeof tc.function.arguments === "string"
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments;
          } catch {
            toolArgs = {};
          }

          toolCallsExecuted.push({ name: toolName, args: toolArgs });

          const result = await executeTool(supabase, orgId, toolName, toolArgs);
          toolResults.push({
            tool_call_id: tc.id,
            name: toolName,
            content: result,
          });
        }

        // Add tool results to messages and save to DB
        for (const tr of toolResults) {
          messages.push({
            role: "tool",
            content: tr.content,
            tool_call_id: tr.tool_call_id,
          } as Record<string, unknown>);

          await supabase.from("chat_messages").insert({
            conversation_id: conversationId,
            role: "tool",
            content: tr.content,
            tool_call_id: tr.tool_call_id,
          });
        }

        // Continue the loop for the next AI call
        continue;
      }

      // No tool calls — we have the final response
      const finalContent = assistantMessage.content ?? "";

      // Save final assistant message
      await supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: finalContent,
      });

      // Return the final response with metadata
      return new Response(
        JSON.stringify({
          conversation_id: conversationId,
          content: finalContent,
          tool_calls_executed: toolCallsExecuted,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": String(rateLimit.remaining),
          },
        }
      );
    }

    // If we exhausted tool rounds, do one final non-tool call
    log.warn("Exhausted tool rounds, making final call without tools");
    const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: false,
      }),
    });

    let finalContent = "I apologise, but I was unable to complete your request. Please try rephrasing your question.";
    if (finalResponse.ok) {
      const finalData = await finalResponse.json();
      finalContent = finalData.choices?.[0]?.message?.content ?? finalContent;
    }

    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: finalContent,
    });

    return new Response(
      JSON.stringify({
        conversation_id: conversationId,
        content: finalContent,
        tool_calls_executed: toolCallsExecuted,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      }
    );
  } catch (error) {
    log.error("Portfolio chat error", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ─── Conversation management handlers ────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function handleListConversations(
  supabase: any,
  userId: string,
  corsHeaders: Record<string, string>
) {
  const { data, error } = await supabase
    .from("chat_conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ conversations: data ?? [] }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
async function handleDeleteConversation(
  supabase: any,
  conversationId: string,
  corsHeaders: Record<string, string>
) {
  const { error } = await supabase
    .from("chat_conversations")
    .delete()
    .eq("id", conversationId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
async function handleUpdateConversation(
  supabase: any,
  conversationId: string,
  body: { title?: string },
  corsHeaders: Record<string, string>
) {
  const updates: Record<string, unknown> = {};
  if (body.title) updates.title = body.title;

  const { data, error } = await supabase
    .from("chat_conversations")
    .update(updates)
    .eq("id", conversationId)
    .select("id, title, updated_at")
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGetMessages(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  corsHeaders: Record<string, string>
) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, tool_calls, tool_call_id, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ messages: data ?? [] }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
