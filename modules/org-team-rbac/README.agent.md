# Agent Guide: Org, Team & RBAC Module

Read `module.json`, `llms.txt`, and `src/index.ts` before changing this module.

Rules:

1. Keep use cases framework-neutral. Do not import SvelteKit, Hono, or app route code.
2. Put persistence behind `RbacStore`. Never make real I/O in tests — use
   `createMemoryRbacStore()`.
3. Preserve the correctness invariants — they are the reason this module exists:
   - **Tenant isolation**: `resolvePermissions`/`authorize` return `[]`/403 for a
     non-member. Every membership lookup is keyed by `(orgId, userId)`. Roles and
     invitations referenced cross-org are rejected.
   - **Permission resolution**: derive permissions from the role (use
     `hasPermission` with wildcard support); never hardcode `role === "admin"`.
   - **Single-use + expiring invites**: keep the pending-status and expiry checks
     in `acceptInvitation`.
   - **Last-owner guard**: keep the `countOwners` check in `removeMember` and
     `updateMemberRole`.
4. Risk `high`: migrations, permission changes, and production deploy are
   approval-gated.
5. Run `pnpm --filter @microservices-sh/org-team-rbac build` and `check:spec` after edits.
