import { createRoleInputSchema } from "../schemas";
import type { RbacStore } from "../ports";
import type { Role } from "../types";

// Create a custom role within an org.
export async function createRole(input: unknown, deps: { store: RbacStore }) {
  const parsed = createRoleInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, status: 400 as const, data: null, error: { code: "INVALID_ROLE_INPUT", message: "Role input is invalid.", issues: parsed.error.issues } };
  }

  const org = await deps.store.getOrg(parsed.data.orgId);
  if (!org) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "ORG_NOT_FOUND", message: "Organization not found." } };
  }

  const role: Role = {
    id: "role_" + crypto.randomUUID().slice(0, 16),
    orgId: parsed.data.orgId,
    name: parsed.data.name,
    permissions: parsed.data.permissions
  };
  await deps.store.insertRole(role);

  return { ok: true as const, status: 201 as const, data: { id: role.id, name: role.name } };
}
