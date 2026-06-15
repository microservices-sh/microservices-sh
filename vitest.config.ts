import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "modules/*/src/**/*.test.ts",
      "modules/*/tests/**/*.test.{js,ts}",
      "packages/*/tests/**/*.test.{js,ts}",
      "tests/integration/**/*.test.{js,ts}"
    ],
    // Vendored template copies ship their own module tests that only resolve
    // inside a generated app, not in the monorepo root.
    exclude: ["**/node_modules/**", "**/dist/**", "**/templates/**"],
    environment: "node",
    globals: false
  }
});
