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
    dedupe: ["react", "react-dom", "@react-leaflet/core"],
  },
  build: {
    sourcemap: mode !== 'production' ? true : 'hidden',
    rollupOptions: {
      output: {
        // Only group vendor libs whose consumers are on the eager path.
        // PDF / ZIP / maps / markdown are reached exclusively through dynamic
        // imports (pdf-export flows, backup export, map routes, markdown
        // modals), so letting rollup chunk them automatically keeps them out
        // of the initial preload. Previously a manual "vendor-pdf" chunk was
        // preloaded on every page load just to serve Vite's __vitePreload
        // helper (~4 lines), at a cost of 147 kB gzipped.
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
          "vendor-date": ["date-fns"],
        },
      },
    },
  },
}));
