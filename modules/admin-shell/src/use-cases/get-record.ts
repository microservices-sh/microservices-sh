import { hasPermission } from "../authz";
import type { ResourceRegistry } from "../registry";
import type { TableGateway } from "../ports";
import type { AdminActor } from "../types";

// Fetch one record by primary key. RBAC-gated on the resource's read permission.
export async function getRecord(
  registry: ResourceRegistry,
  resourceName: string,
  id: string,
  deps: { gateway: TableGateway; actor: AdminActor }
) {
  const def = registry.get(resourceName);
  if (!def) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "RESOURCE_NOT_FOUND", message: `Unknown admin resource: ${resourceName}.` } };
  }
  if (!hasPermission(deps.actor, def.permissions.read)) {
    return { ok: false as const, status: 403 as const, data: null, error: { code: "FORBIDDEN", message: "Missing read permission for this resource." } };
  }

  const record = await deps.gateway.get(def, id);
  if (!record) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "RECORD_NOT_FOUND", message: "Record not found." } };
  }
  return { ok: true as const, status: 200 as const, data: { record } };
}
