import { defineConfig } from "drizzle-kit";

// Drizzle Kit config for the template's SQLite/D1 schema.
// Authoritative migrations are hand-authored in ./migrations (they include a
// partial unique index + FKs). Use `drizzle-kit generate` for NEW tables, then
// review the SQL before committing.
export default defineConfig({
  schema: "./src/lib/server/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
});
