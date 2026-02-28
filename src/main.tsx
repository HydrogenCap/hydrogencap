import * as Sentry from '@sentry/react';
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Only initialise Sentry in production when DSN is provided
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
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
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
}

createRoot(document.getElementById("root")!).render(<App />);
