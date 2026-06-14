# Org, Team & RBAC Module

Status: `available` (v0.1.0) · Class: `platform` · Risk: `high`

Multi-tenant organizations for Cloudflare Workers + D1. The B2B foundation other
modules scope against. It encapsulates the multi-tenant failures AI agents ship:

1. **Tenant isolation** — membership is keyed by `(orgId, userId)`; `authorize`
   resolves a non-member to **no permissions**, so access is denied by default.
   This is the boundary a missing `AND org_id = ?` blows open.
2. **Real permission resolution** — permissions come from the member's role
   (with wildcard support), not a flat `role === "admin"` check.
3. **Single-use, expiring invitations** — `acceptInvitation` rejects already-used
   and expired tokens (no forever-valid, replayable invites).
4. **Last-owner protection** — the final owner cannot be removed or downgraded.

## Flow

```ts
import {
  createOrganization, inviteMember, acceptInvitation, authorize,
  createD1RbacStore
} from "@microservices-sh/org-team-rbac";

const store = createD1RbacStore(env.DB);

const org = await createOrganization({ name: "Acme", slug: "acme", ownerUserId: user.id }, { store });
// seeds owner/admin/member roles; user.id is the owner

const invite = await inviteMember({ orgId: org.data.id, email: "sam@acme.com", roleId: org.data.roles.member }, { store });
await acceptInvitation({ token: invite.data.token, userId: sam.id }, { store });

// gate any org-scoped route:
const gate = await authorize(org.data.id, sam.id, "org.read", { store });
if (!gate.ok) return forbidden();
```

## Resources

- D1 (`DB`): `organizations`, `memberships`, `roles`, `invitations` (migration `0001`).

## Verification

```bash
pnpm --filter @microservices-sh/org-team-rbac build
pnpm --filter @microservices-sh/org-team-rbac check:spec
```
