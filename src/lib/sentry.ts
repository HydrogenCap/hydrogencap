/**
 * Capture an exception to Sentry in production only.
 * Use this in catch blocks to avoid noise in development.
 */
export function captureError(error: unknown, context?: string) {
  if (!import.meta.env.PROD) return;
  import('@sentry/react').then((Sentry) => {
    Sentry.captureException(error, {
      extra: { context },
    });
  });
}
