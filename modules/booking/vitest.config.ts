import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
    // Run tests in a forked process started with --experimental-sqlite so the
    // D1 integration suite can use Node's built-in node:sqlite. Suites that
    // don't touch SQLite are unaffected.
    pool: "forks",
    poolOptions: {
      forks: {
        execArgv: ["--experimental-sqlite"]
      }
    }
  }
});
