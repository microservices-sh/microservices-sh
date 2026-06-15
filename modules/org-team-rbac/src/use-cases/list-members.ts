import { ok } from "@microservices-sh/connection-contract";
import { orgTeamRbacMeta } from "../meta";
import type { RbacStore } from "../ports";

// List active members of an org. Always org-scoped — there is no cross-org list.
//
// This use case is framework-neutral: it never imports SvelteKit or Hono.
export async function listMembers(orgId: string, deps: { store: RbacStore; now?: () => number; correlationId?: string }) {
  const meta = orgTeamRbacMeta(deps);
  const memberships = (await deps.store.listMemberships(orgId)).filter((m) => m.status === "active");
  return ok(200, { members: memberships, count: memberships.length }, meta);
}
