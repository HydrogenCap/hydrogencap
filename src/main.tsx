import { createRoot } from "react-dom/client";
import { initSentry } from "@/lib/sentry";
import { reportWebVitals } from "@/lib/webVitals";
import App from "./App.tsx";
import "./index.css";

// Initialise Sentry before rendering
initSentry();

createRoot(document.getElementById("root")!).render(<App />);

// Report Core Web Vitals after mount
reportWebVitals();
