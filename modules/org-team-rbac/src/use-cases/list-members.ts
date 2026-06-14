import type { RbacStore } from "../ports";

// List active members of an org. Always org-scoped — there is no cross-org list.
export async function listMembers(orgId: string, deps: { store: RbacStore }) {
  const memberships = (await deps.store.listMemberships(orgId)).filter((m) => m.status === "active");
  return { ok: true as const, status: 200 as const, data: { members: memberships, count: memberships.length } };
}
