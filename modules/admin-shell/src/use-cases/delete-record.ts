import { ok, err } from "@microservices-sh/connection-contract";
import { hasPermission } from "../authz";
import { onAdminAction } from "../hooks";
import { adminShellMeta } from "../meta";
import type { ResourceRegistry } from "../registry";
import type { TableGateway } from "../ports";
import type { AdminActor, AdminAuditEntry, DomainEvent } from "../types";

// Delete a record. Soft-deletes when the resource defines softDelete (set the
// flag column), otherwise hard-deletes. Generated admin UIs from agents tend to
// always hard-delete; respecting the resource's soft-delete config is the whole
// point of routing deletes through here. Emits admin.record_deleted.
export async function deleteRecord(
  registry: ResourceRegistry,
  resourceName: string,
  id: string,
  deps: {
    gateway: TableGateway;
    actor: AdminActor;
    now?: () => number;
    correlationId?: string;
    audit?: (entry: AdminAuditEntry) => Promise<void>;
  }
) {
  const meta = adminShellMeta(deps);

  const def = registry.get(resourceName);
  if (!def) {
    return err(404, { code: "admin-shell.RESOURCE_NOT_FOUND", message: `Unknown admin resource: ${resourceName}.` }, meta);
  }
  if (!hasPermission(deps.actor, def.permissions.write)) {
    return err(403, { code: "admin-shell.FORBIDDEN", message: "Missing write permission for this resource." }, meta);
  }

  const existing = await deps.gateway.get(def, id);
  if (!existing) {
    return err(404, { code: "admin-shell.RECORD_NOT_FOUND", message: "Record not found." }, meta);
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

  const event: DomainEvent = {
    name: "admin.record_deleted",
    correlationId: meta.correlationId,
    payload: { resource: resourceName, recordId: id, actorId: deps.actor.id }
  };

  return ok(200, { id, mode, event }, meta);
}
