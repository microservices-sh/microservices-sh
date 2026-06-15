import { ok, err } from "@microservices-sh/connection-contract";
import { createRoleInputSchema } from "../schemas";
import { orgTeamRbacMeta } from "../meta";
import type { RbacStore } from "../ports";
import type { Role } from "../types";

// Create a custom role within an org.
//
// This use case is framework-neutral: it never imports SvelteKit or Hono.
export async function createRole(input: unknown, deps: { store: RbacStore; now?: () => number; correlationId?: string }) {
  const meta = orgTeamRbacMeta(deps);

  const parsed = createRoleInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "org-team-rbac.INVALID_ROLE_INPUT", message: "Role input is invalid.", issues: parsed.error.issues }, meta);
  }

  const org = await deps.store.getOrg(parsed.data.orgId);
  if (!org) {
    return err(404, { code: "org-team-rbac.ORG_NOT_FOUND", message: "Organization not found." }, meta);
  }

  const role: Role = {
    id: "role_" + crypto.randomUUID().slice(0, 16),
    orgId: parsed.data.orgId,
    name: parsed.data.name,
    permissions: parsed.data.permissions
  };
  await deps.store.insertRole(role);

  return ok(201, { id: role.id, name: role.name }, meta);
}
