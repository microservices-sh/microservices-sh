# Detached API Boundary

The template must not put business logic directly in SvelteKit routes. Tenancy,
RBAC, billing, audit, and admin behavior all live in framework-neutral module use
cases. SvelteKit `+page.server.ts` files are adapters.

## Layers

| Layer | Owns | Example |
|-------|------|---------|
| Route adapter | form/query parsing, redirects, response mapping | `src/routes/signup/+page.server.ts` |
| Use case | domain orchestration | `createOrganization`, `startSubscription` |
| Port | dependency contract | `RbacStore`, `BillingStore` |
| Adapter | concrete infrastructure | `createD1RbacStore`, `createMemoryBillingStore` |
| Hook | user customization | `beforeInvite`, `beforeSubscriptionChange` |

## Desktop Import Boundary

`src/routes/api/desktop/import/+server.ts` is an HTTP adapter for the desktop
companion. It authenticates with `DESKTOP_IMPORT_TOKEN`, validates an approved
draft payload, resolves the company org, enqueues a `desktop.draft.import` job,
and records an audit event. It must not bypass module use cases or write
production records directly from the route.

The desktop app keeps local draft state only. The Worker remains the canonical
multi-user ERP backend: D1 for module records, R2 for files/images, KV for
shared gateway state, Queues for async processing, and audit-log for traceability.

## Project Progress Boundary

`src/routes/app/project-progress/*` are SvelteKit adapters over
`createProjectProgressService(...)`. They validate the active company org,
validate customer ids through the customer module, then call project-progress
service methods for project creation, status updates, timeline logs, comments,
and access grants. Routes must not write `project_progress_*` tables directly.

`src/routes/project/[accessToken]` treats the access token as a bearer secret.
It rate-limits lookup attempts through `locals.rateLimitStore`, resolves the
single company org from RBAC, calls `resolvePublicProject`, and maps media to
safe metadata only. Public responses must not expose raw storage keys or grant
mutation actions.

## Route Adapter Shape

```ts
export const actions: Actions = {
  default: async ({ request, locals, cookies }) => {
    const form = await request.formData();
    const result = await createOrganization(
      { name: String(form.get("orgName")), slug, ownerUserId: userId },
      { store: locals.rbacStore }
    );
    if (!result.ok) return fail(result.status, { error: result.error?.message });
    rememberOrg(cookies, result.data.id);
    throw redirect(303, "/app");
  }
};
```

## Use Case Shape

```ts
export async function createOrganization(input: unknown, deps: { store: RbacStore }) {
  // validate input
  // enforce uniqueness (slug)
  // create org, seed owner/admin/member roles
  // make the creator the owner
  // return a framework-neutral result
}
```

## Authorization Boundary

Every `/app/*` route is gated by membership, not a flat admin flag:

```ts
// src/routes/app/+layout.server.ts
const permissions = await resolvePermissions(activeOrgId, user.id, { store });
// per-action gate:
const decision = await authorize(orgId, user.id, "member.manage", { store });
```

`resolvePermissions` returns `[]` for non-members — the tenant-isolation boundary.
The same use cases are callable from SvelteKit, Hono, MCP tools, tests, and jobs.
