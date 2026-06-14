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
