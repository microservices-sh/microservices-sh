import { ok, err } from "@microservices-sh/connection-contract";
import { hasPermission } from "../authz";
import { beforeWrite, onAdminAction } from "../hooks";
import { validateValues } from "../validate";
import { adminShellMeta } from "../meta";
import type { ResourceRegistry } from "../registry";
import type { TableGateway } from "../ports";
import type { AdminActor, AdminAuditEntry, AdminRecord, DomainEvent } from "../types";

// Update a record: RBAC write, partial validation (only editable columns),
// beforeWrite, update, audit, then emit admin.record_updated. Unknown/non-editable
// fields are rejected, not silently dropped.
export async function updateRecord(
  registry: ResourceRegistry,
  resourceName: string,
  id: string,
  values: AdminRecord,
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

  const validated = validateValues(def, values ?? {}, { partial: true });
  if (!validated.ok) {
    return err(400, { code: "admin-shell.VALIDATION_FAILED", message: "Values are invalid.", issues: validated.errors }, meta);
  }
  if (Object.keys(validated.values).length === 0) {
    return err(400, { code: "admin-shell.NO_EDITABLE_FIELDS", message: "No editable fields supplied." }, meta);
  }

  const hooked = await beforeWrite(resourceName, "update", validated.values);
  if (!hooked) {
    return err(409, { code: "admin-shell.WRITE_BLOCKED", message: "Update was blocked by beforeWrite." }, meta);
  }

  await deps.gateway.update(def, id, hooked);

  const entry: AdminAuditEntry = {
    action: "update",
    resource: resourceName,
    recordId: id,
    actorId: deps.actor.id,
    at: new Date(deps.now?.() ?? Date.now()).toISOString()
  };
  await onAdminAction(entry);
  if (deps.audit) await deps.audit(entry);

  const event: DomainEvent = {
    name: "admin.record_updated",
    correlationId: meta.correlationId,
    payload: { resource: resourceName, recordId: id, actorId: deps.actor.id }
  };

  return ok(200, { id, event }, meta);
}
