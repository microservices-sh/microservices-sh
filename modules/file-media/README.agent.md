# Agent Guide: File & Media Module

Read `module.json`, `llms.txt`, and `src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral. Do not import SvelteKit, Hono, or app route code.
2. Put metadata behind `MediaStore` and all object I/O behind the `ObjectStorage`
   port. Never make real I/O in tests — use `createMemoryMediaStore()` and
   `createMemoryObjectStorage()`.
3. Preserve the correctness invariants — they are why this module exists:
   - **Tenant isolation**: build every key with `buildObjectKey` (tenant-prefixed)
     and keep both tenant guards in `deleteFile`/`completeUpload`. Never accept a
     caller-supplied raw key.
   - **Owner isolation**: client/customer/user portals must write and list with
     `ownerId`; tenant-wide listFiles is only for staff/admin contexts.
   - **Validation before accept**: keep content-type allow-listing and the size
     ceiling in `createUploadTicket`, and the existence+size check in
     `completeUpload`.
   - **No orphans**: keep `expireStaleTickets` deleting abandoned objects.
   - **Soft delete**: `deleteFile` removes the object but keeps the record.
4. Risk `medium`: migrations, object deletion, and production deploy are
   approval-gated.
5. Run `pnpm --filter @microservices-sh/file-media build` and `check:spec` after edits.
