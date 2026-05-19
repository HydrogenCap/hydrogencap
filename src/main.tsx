import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { initSentry } from "@/lib/sentry";
import { reportWebVitals } from "@/lib/webVitals";
import App from "./App.tsx";
import "./index.css";

// Initialise Sentry before rendering
initSentry();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
);

// Report Core Web Vitals after mount
reportWebVitals();
