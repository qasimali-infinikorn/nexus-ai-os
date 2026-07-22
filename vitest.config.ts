import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // PGlite + full migration apply in beforeAll can exceed the default 10s
    // when several DB suites start in parallel.
    hookTimeout: 60_000,
    testTimeout: 30_000
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  }
});
