import { hasPermission } from "../authz";
import { onAdminAction } from "../hooks";
import type { ResourceRegistry } from "../registry";
import type { TableGateway } from "../ports";
import type { AdminActor, AdminAuditEntry } from "../types";

// Delete a record. Soft-deletes when the resource defines softDelete (set the
// flag column), otherwise hard-deletes. Generated admin UIs from agents tend to
// always hard-delete; respecting the resource's soft-delete config is the whole
// point of routing deletes through here.
export async function deleteRecord(
  registry: ResourceRegistry,
  resourceName: string,
  id: string,
  deps: {
    gateway: TableGateway;
    actor: AdminActor;
    now?: () => number;
    audit?: (entry: AdminAuditEntry) => Promise<void>;
  }
) {
  const def = registry.get(resourceName);
  if (!def) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "RESOURCE_NOT_FOUND", message: `Unknown admin resource: ${resourceName}.` } };
  }
  if (!hasPermission(deps.actor, def.permissions.write)) {
    return { ok: false as const, status: 403 as const, data: null, error: { code: "FORBIDDEN", message: "Missing write permission for this resource." } };
  }

  const existing = await deps.gateway.get(def, id);
  if (!existing) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "RECORD_NOT_FOUND", message: "Record not found." } };
  }

  const mode = def.softDelete ? "soft" : "hard";
  if (def.softDelete) {
    await deps.gateway.softDelete(def, id);
  } else {
    await deps.gateway.hardDelete(def, id);
  }

  const entry: AdminAuditEntry = {
    action: "delete",
    resource: resourceName,
    recordId: id,
    actorId: deps.actor.id,
    at: new Date(deps.now?.() ?? Date.now()).toISOString()
  };
  await onAdminAction(entry);
  if (deps.audit) await deps.audit(entry);

  return { ok: true as const, status: 200 as const, data: { id, mode } };
}
