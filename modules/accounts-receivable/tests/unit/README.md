# Accounts Receivable Tests

Add unit tests for schemas, hooks, use cases, and adapters.

Test the D1 adapter against a real engine via `createTestD1` from `@microservices-sh/test-utils` (better-sqlite3) — NOT node:sqlite, which collapses duplicate join columns and can't back drizzle. See docs/module-data-access-standard.md.
