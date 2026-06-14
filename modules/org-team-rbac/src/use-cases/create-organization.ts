import { DEFAULT_ROLES } from "../config";
import { createOrganizationInputSchema } from "../schemas";
import type { RbacStore } from "../ports";
import type { Membership, Organization, Role } from "../types";

// Create an org, seed its default roles (owner/admin/member), and make the
// creator the owner. Slug is unique per install.
export async function createOrganization(input: unknown, deps: { store: RbacStore; now?: () => number }) {
  const parsed = createOrganizationInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, status: 400 as const, data: null, error: { code: "INVALID_ORG_INPUT", message: "Organization input is invalid.", issues: parsed.error.issues } };
  }

  const existing = await deps.store.getOrgBySlug(parsed.data.slug);
  if (existing) {
    return { ok: false as const, status: 409 as const, data: null, error: { code: "SLUG_TAKEN", message: `Slug ${parsed.data.slug} is already in use.` } };
  }

  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const orgId = "org_" + crypto.randomUUID().slice(0, 16);
  const org: Organization = { id: orgId, name: parsed.data.name, slug: parsed.data.slug, status: "active", createdAt: nowIso, updatedAt: nowIso };
  await deps.store.insertOrg(org);

  const roleIdByName: Record<string, string> = {};
  for (const def of DEFAULT_ROLES) {
    const role: Role = { id: "role_" + crypto.randomUUID().slice(0, 16), orgId, name: def.name, permissions: [...def.permissions] };
    await deps.store.insertRole(role);
    roleIdByName[def.name] = role.id;
  }

  const membership: Membership = {
    id: "mem_" + crypto.randomUUID().slice(0, 16),
    orgId,
    userId: parsed.data.ownerUserId,
    roleId: roleIdByName.owner,
    status: "active",
    createdAt: nowIso,
    updatedAt: nowIso
  };
  await deps.store.insertMembership(membership);

  return { ok: true as const, status: 201 as const, data: { id: orgId, slug: org.slug, roles: roleIdByName, ownerMembershipId: membership.id } };
}
