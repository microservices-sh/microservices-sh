import { defineConfig } from "vitest/config";

// Self-contained config so the proof runs on demand without being swept into the
// main `pnpm test` suite. Run it with:
//   npx vitest run --config proofs/no-cross-tenant-leak/vitest.config.ts
export default defineConfig({
  test: {
    root: __dirname,
    include: ["*.proof.test.ts"]
  }
});
