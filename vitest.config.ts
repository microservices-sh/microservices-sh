import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["modules/*/src/**/*.test.ts"],
    environment: "node",
    globals: false
  }
});
