import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    ...(process.env.VITE_ANALYZE === "true"
      ? [visualizer({ open: true, filename: "dist/bundle-report.html", gzipSize: true, brotliSize: true })]
      : []),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": [
            "class-variance-authority",
            "clsx",
            "tailwind-merge",
            "lucide-react",
            "@radix-ui/react-dialog",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
          ],
          "vendor-data": ["@tanstack/react-query", "@supabase/supabase-js"],
          "vendor-charts": ["recharts"],
          "vendor-maps": ["leaflet", "react-leaflet"],
          "vendor-pdf": ["jspdf", "jspdf-autotable", "pdf-lib"],
          "vendor-zip": ["jszip", "file-saver"],
          "vendor-markdown": ["react-markdown"],
          "vendor-date": ["date-fns"],
        },
      },
    },
  },
}));
