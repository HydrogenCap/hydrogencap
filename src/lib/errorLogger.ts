import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from '@/hooks/useUserOrg';

type Severity = 'info' | 'warning' | 'error' | 'critical';

interface LogErrorParams {
  source: string;
  message: string;
  severity?: Severity;
  context?: Record<string, unknown>;
  error?: unknown;
}

/**
 * Best-effort logger that records a failure into the `errors_log` table.
 * Never throws — silent on failure so it never breaks the calling flow.
 * Use from catch blocks for high-signal failures (mutations, edge-function calls).
 */
export async function logError({ source, message, severity = 'error', context, error }: LogErrorParams): Promise<void> {
  try {
    const orgId = await fetchUserOrgId().catch(() => null);
    const stack = error instanceof Error ? error.stack ?? null : null;
    const enrichedContext = {
      ...(context || {}),
      ...(error instanceof Error ? { errorName: error.name, errorMessage: error.message } : {}),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    await supabaseAny.from('errors_log').insert({
      org_id: orgId,
      source,
      severity,
      message,
      context: enrichedContext,
      stack,
    });
  } catch {
    // Swallow — logging must never break the app
  }
}
