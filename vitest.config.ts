import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
      // Resolve the workspace plugin to its source. The plugin's
      // package.json points "main" at dist/plugin.cjs.js which is only
      // built for production iOS bundling. Vitest's TS-aware resolver
      // can read src/ directly — no plugin build step needed for tests.
      "@buildalpha/capacitor-voice": path.resolve(
        templateRoot,
        "packages/capacitor-voice/src/index.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "tests/**/*.test.ts",
      "packages/**/*.test.ts",
      "client/**/*.test.ts",
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
});
