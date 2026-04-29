/**
 * Structured logger for edge functions.
 * Outputs one JSON line per event to stdout (Supabase's structured-log path).
 *
 * Two complementary APIs:
 *
 *   1. Free-form (legacy):
 *        const log = createLogger('fn', req);
 *        log.info('msg', { foo: 1 });
 *
 *   2. Per-invocation (preferred for ops/oncall):
 *        Deno.serve(withInvocationLog('fn', async (req, log) => {
 *          // ...resolve auth...
 *          log.withOrg(orgId);
 *          return new Response(...);
 *        }));
 *
 *      Auto-emits two JSON lines per request:
 *        { ts, fn, request_id, user_id, org_id, msg: 'invocation.start', method, url }
 *        { ts, fn, request_id, user_id, org_id, latency_ms, outcome, status?, error?, msg: 'invocation.end' }
 *
 *      Outcomes: 'ok' (2xx/3xx), 'client_error' (4xx), 'server_error' (5xx), 'error' (thrown).
 */

interface LogContext {
  functionName: string;
  requestId: string;
  userId?: string;
  orgId?: string;
  [key: string]: unknown;
}

export interface Logger {
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  /** Returns a new Logger with userId attached. (legacy — InvocationLogger mutates in place) */
  withUser: (userId: string) => Logger;
}

export interface InvocationLogger extends Logger {
  /** Attach the resolved org_id to this invocation; appears on all subsequent log lines and on invocation.end. */
  withOrg: (orgId: string | null | undefined) => InvocationLogger;
  /** Attach (or replace) the resolved user_id mid-flight. */
  setUser: (userId: string | null | undefined) => InvocationLogger;
  /** Emit an arbitrary structured event tied to this invocation. */
  event: (name: string, data?: Record<string, unknown>) => void;
  /** Read the current request id (e.g. to surface in error responses). */
  readonly requestId: string;
}

function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Best-effort decode of the JWT 'sub' claim from an Authorization: Bearer header.
 * Returns null on any parse failure. Does NOT validate the signature — only
 * used for log enrichment, never for authorization decisions.
 */
function extractUserIdFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    if (typeof payload?.sub === 'string' && payload.sub.length > 0) return payload.sub;
    return null;
  } catch {
    return null;
  }
}

function emit(level: 'info' | 'warn' | 'error', context: LogContext, message: string, data?: Record<string, unknown>) {
  const entry = {
    level,
    ts: new Date().toISOString(),
    fn: context.functionName,
    rid: context.requestId,
    uid: context.userId || null,
    org_id: context.orgId || null,
    msg: message,
    ...data,
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export function createLogger(functionName: string, req?: Request): Logger {
  const context: LogContext = {
    functionName,
    requestId: generateRequestId(),
  };

  if (req) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      // Preserve legacy behaviour: createLogger() marks userId 'pending' so older
      // tests / callers still see a non-null uid until withUser() is called.
      context.userId = 'pending';
    }
  }

  const logger: Logger = {
    info: (msg, data) => emit('info', context, msg, data),
    warn: (msg, data) => emit('warn', context, msg, data),
    error: (msg, data) => emit('error', context, msg, data),
    withUser: (userId: string) => {
      context.userId = userId;
      return logger;
    },
  };

  return logger;
}

/**
 * Wrap a handler with request timing and error logging (free-form info/error lines).
 * Kept for backwards compatibility with existing callers.
 */
export function withLogging(
  functionName: string,
  handler: (req: Request, log: Logger) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const log = createLogger(functionName, req);
    const start = Date.now();

    log.info('Request started', { method: req.method, url: req.url });

    try {
      const response = await handler(req, log);
      const durationMs = Date.now() - start;
      log.info('Request completed', { status: response.status, durationMs });
      return response;
    } catch (error) {
      const durationMs = Date.now() - start;
      log.error('Request failed', {
        durationMs,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3).join(' | ') : undefined,
      });
      throw error;
    }
  };
}

/**
 * Wrap a Deno.serve / serve handler with structured per-invocation logging.
 *
 * Emits 'invocation.start' on entry and 'invocation.end' on exit (both success
 * and failure paths) with: ts, fn, request_id, user_id, org_id, latency_ms,
 * outcome, plus method/url/status/error context.
 *
 * Pure observability — never alters the response body, headers, or status,
 * never short-circuits the request, never performs a network call.
 *
 * - user_id is best-effort decoded from the Authorization JWT (no signature
 *   verification — handlers still call supabase.auth.getUser() for real auth).
 * - org_id starts null; handlers may call log.withOrg(orgId) once resolved.
 */
export function withInvocationLog(
  functionName: string,
  handler: (req: Request, log: InvocationLogger) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const context: LogContext = {
      functionName,
      requestId: crypto.randomUUID(),
    };

    const authHeader = req.headers.get('Authorization');
    const decodedUid = extractUserIdFromAuthHeader(authHeader);
    if (decodedUid) context.userId = decodedUid;

    const log: InvocationLogger = {
      get requestId() {
        return context.requestId;
      },
      info: (msg, data) => emit('info', context, msg, data),
      warn: (msg, data) => emit('warn', context, msg, data),
      error: (msg, data) => emit('error', context, msg, data),
      withUser: (userId: string) => {
        context.userId = userId;
        return log;
      },
      setUser: (userId) => {
        context.userId = userId ?? undefined;
        return log;
      },
      withOrg: (orgId) => {
        context.orgId = orgId ?? undefined;
        return log;
      },
      event: (name, data) => emit('info', context, name, data),
    };

    const start = Date.now();
    let url: string;
    try {
      url = req.url;
    } catch {
      url = '';
    }

    // Skip start/end noise for CORS preflight — they're cheap and ubiquitous.
    const isPreflight = req.method === 'OPTIONS';

    if (!isPreflight) {
      emit('info', context, 'invocation.start', { method: req.method, url });
    }

    try {
      const response = await handler(req, log);
      if (!isPreflight) {
        const latencyMs = Date.now() - start;
        const status = response.status;
        const outcome = status >= 500 ? 'server_error' : status >= 400 ? 'client_error' : 'ok';
        emit(outcome === 'ok' ? 'info' : 'warn', context, 'invocation.end', {
          latency_ms: latencyMs,
          outcome,
          status,
        });
      }
      return response;
    } catch (error) {
      const latencyMs = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);
      emit('error', context, 'invocation.end', {
        latency_ms: latencyMs,
        outcome: 'error',
        error: message,
      });
      throw error;
    }
  };
}
