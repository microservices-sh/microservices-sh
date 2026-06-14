# Agent Guide: Admin Shell Module

Read `module.json`, `llms.txt`, and `src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral. Do not import SvelteKit, Hono, or app route
   code. The admin UI is rendered by the host app, not here.
2. Put data access behind the `TableGateway` port. Never make real I/O in tests —
   use `createMemoryTableGateway()`.
3. Preserve the correctness invariants — they are the reason this module exists:
   - **Authz first**: every use case calls `hasPermission(actor, def.permissions.*)`
     before reading or writing. Never skip it.
   - **Identifiers from the registry only**: the gateway builds SQL from
     definition table/column names (validated via the IDENT regex + quoted) and
     binds all values. Never interpolate request input into SQL.
   - **Soft-delete awareness**: `deleteRecord` must honor `def.softDelete`.
   - **Editable-only writes**: `validateValues` accepts only columns marked
     editable and rejects the rest.
4. Risk `high`: data mutations, permission changes, and production deploy are
   approval-gated.
5. Run `pnpm --filter @microservices-sh/admin-shell build` and `check:spec` after edits.
