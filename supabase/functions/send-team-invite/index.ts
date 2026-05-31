import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Resend } from 'https://esm.sh/resend@4.0.0';
import { z } from "https://esm.sh/zod@3.23.8";
import { validateBody } from "../_shared/validate.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

import { withInvocationLog } from "../_shared/logger.ts";
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
  };
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(withInvocationLog("send-team-invite", async (req, _invocationLog) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(RESEND_API_KEY);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No auth header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const rateLimit = await checkRateLimit(user.id, 'send-team-invite', 20, 60);
    if (!rateLimit.allowed) return rateLimitResponse(corsHeaders, rateLimit.remaining, rateLimit.resetAt);

    const InviteSchema = z.object({
      inviteId: z.string().uuid("Invalid inviteId"),
    });

    const parsed = await validateBody(req, InviteSchema, corsHeaders);
    if ("error" in parsed) return parsed.error;
    const { inviteId } = parsed.data;

    const { data: invite, error: inviteError } = await supabase
      .from('team_invites')
      .select('*, organizations(name)')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) throw new Error('Invite not found');

    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', invite.org_id)
      .single();

    if (!membership) throw new Error('Not a member of this organisation');
    if (membership.role === 'viewer') throw new Error('Viewers cannot send invites');

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', user.id)
      .single();

    const inviterName = profile?.full_name || profile?.email || 'A team member';
    const orgName = (invite.organizations as any)?.name || 'the organisation';
    const reqOrigin = req.headers.get('origin') ?? '';
    const safeOrigin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : 'https://hydrogencapital.lovable.app';
    const acceptUrl = `${safeOrigin}/team/accept/${invite.token}`;

    const roleName = invite.role === 'admin' ? 'Admin' : 'Viewer';

    const { error: emailError } = await resend.emails.send({
      from: 'HydrogenCap <onboarding@resend.dev>',
      to: invite.email,
      subject: `You've been invited to ${orgName} on HydrogenCap`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    
    <div style="background:#0f172a;padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:600;">HydrogenCap</h1>
    </div>

    <div style="padding:32px 24px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#0f172a;">You're invited!</h2>
      
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 8px;">
        <strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on HydrogenCap as a <strong>${roleName}</strong>.
      </p>

      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
        ${invite.role === 'admin'
          ? 'As an Admin, you\'ll be able to manage properties, compliance, and documents.'
          : 'As a Viewer, you\'ll have read-only access to the portfolio.'}
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${acceptUrl}" 
           style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
          Accept Invite
        </a>
      </div>

      <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:0;">
        This invite expires in 7 days. If you don't have an account, you'll be asked to create one first.
      </p>
    </div>

    <div style="border-top:1px solid #e2e8f0;padding:16px 24px;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">
        HydrogenCap — Property Portfolio Management
      </p>
    </div>
  </div>
</body>
</html>`,
    });

    if (emailError) {
      console.error('Email send error:', emailError);
      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('send-team-invite error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}));
