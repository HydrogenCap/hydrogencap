/**
 * Sentry wrappers.
 *
 * `@sentry/react` is ~420 kB minified. We lazy-load it on first use so it
 * doesn't bloat the main bundle. The init call triggers the import; from
 * that point on `sentryReady` resolves to the loaded module.
 */
type SentryModule = typeof import('@sentry/react');

let sentryReady: Promise<SentryModule> | null = null;

function loadSentry(): Promise<SentryModule> {
  if (!sentryReady) {
    sentryReady = import('@sentry/react');
  }
  return sentryReady;
}

/**
 * Initialise Sentry error tracking.
 * Only activates when VITE_SENTRY_DSN is set.
 */
export async function initSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN) return;

  const Sentry = await loadSentry();
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 0.1,
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}

/** Tag the current Sentry scope with the authenticated user and org. */
export async function setSentryUser(userId: string, orgId?: string) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  const Sentry = await loadSentry();
  Sentry.setUser({ id: userId });
  if (orgId) {
    Sentry.setTag('org_id', orgId);
  }
}

/** Clear user context on logout. */
export async function clearSentryUser() {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  const Sentry = await loadSentry();
  Sentry.setUser(null);
}

/**
 * Capture an exception to Sentry in production only.
 * Use this in catch blocks to avoid noise in development.
 */
export async function captureError(error: unknown, context?: string) {
  if (!import.meta.env.PROD) return;
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  const Sentry = await loadSentry();
  Sentry.captureException(error, {
    extra: { context },
  });
}
