import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**"],
      exclude: [
        "**/*.test.*",
        "**/*.spec.*",
        "**/__tests__/**",
        "src/test/**",
        "src/integrations/supabase/types.ts",
      ],
      // Ratchet: thresholds set just below current baseline so coverage can
      // only go up. Raise these numbers as new tests land.
      thresholds: {
        statements: 7.1,
        branches: 53,
        functions: 21.8,
        lines: 7.1,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
