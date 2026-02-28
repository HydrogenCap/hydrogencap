/**
 * Structured logger for edge functions.
 * Outputs JSON lines for easy parsing in logs.
 *
 * Usage:
 *   const log = createLogger('ai-compliance-checker', req);
 *   log.info('Processing document', { propertyId, fileSize });
 *   log.error('AI gateway failed', { status: 500 });
 */

interface LogContext {
  functionName: string;
  requestId: string;
  userId?: string;
  [key: string]: unknown;
}

interface Logger {
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  withUser: (userId: string) => Logger;
}

function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

function emit(level: 'info' | 'warn' | 'error', context: LogContext, message: string, data?: Record<string, unknown>) {
  const entry = {
    level,
    ts: new Date().toISOString(),
    fn: context.functionName,
    rid: context.requestId,
    uid: context.userId || null,
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
 * Wrap a handler with request timing and error logging.
 */
export function withLogging(
  functionName: string,
  handler: (req: Request, log: Logger) => Promise<Response>
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
