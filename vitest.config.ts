import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "modules/*/src/**/*.test.ts",
      "modules/*/tests/**/*.test.{js,ts}",
      "packages/**/tests/**/*.test.{js,ts}",
      "tests/integration/**/*.test.{js,ts}"
    ],
    environment: "node",
    globals: false
  }
});
