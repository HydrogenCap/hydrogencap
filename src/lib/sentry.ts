import * as Sentry from '@sentry/react';

/**
 * Initialise Sentry error tracking.
 * Only activates when VITE_SENTRY_DSN is set.
 */
export function initSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN) return;

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
export function setSentryUser(userId: string, orgId?: string) {
  Sentry.setUser({ id: userId });
  if (orgId) {
    Sentry.setTag('org_id', orgId);
  }
}

/** Clear user context on logout. */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * Capture an exception to Sentry in production only.
 * Use this in catch blocks to avoid noise in development.
 */
export function captureError(error: unknown, context?: string) {
  if (!import.meta.env.PROD) return;
  Sentry.captureException(error, {
    extra: { context },
  });
}
