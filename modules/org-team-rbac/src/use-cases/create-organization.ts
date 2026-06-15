import { ok, err } from "@microservices-sh/connection-contract";
import { DEFAULT_ROLES } from "../config";
import { createOrganizationInputSchema } from "../schemas";
import { orgTeamRbacMeta } from "../meta";
import type { RbacStore } from "../ports";
import type { DomainEvent, Membership, Organization, Role } from "../types";

// Create an org, seed its default roles (owner/admin/member), and make the
// creator the owner. Slug is unique per install. Emits org.created.
//
// This use case is framework-neutral: it never imports SvelteKit or Hono.
export async function createOrganization(
  input: unknown,
  deps: { store: RbacStore; now?: () => number; correlationId?: string }
) {
  const meta = orgTeamRbacMeta(deps);

  const parsed = createOrganizationInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "org-team-rbac.INVALID_ORG_INPUT", message: "Organization input is invalid.", issues: parsed.error.issues }, meta);
  }

  const existing = await deps.store.getOrgBySlug(parsed.data.slug);
  if (existing) {
    return err(409, { code: "org-team-rbac.SLUG_TAKEN", message: `Slug ${parsed.data.slug} is already in use.` }, meta);
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

  const event: DomainEvent = {
    name: "org.created",
    correlationId: meta.correlationId,
    payload: { orgId, slug: org.slug, ownerUserId: parsed.data.ownerUserId }
  };

  return ok(201, { id: orgId, slug: org.slug, roles: roleIdByName, ownerMembershipId: membership.id, event }, meta);
}
