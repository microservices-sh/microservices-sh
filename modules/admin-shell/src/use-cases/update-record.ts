import { hasPermission } from "../authz";
import { beforeWrite, onAdminAction } from "../hooks";
import { validateValues } from "../validate";
import type { ResourceRegistry } from "../registry";
import type { TableGateway } from "../ports";
import type { AdminActor, AdminAuditEntry, AdminRecord } from "../types";

// Update a record: RBAC write, partial validation (only editable columns),
// beforeWrite, update, audit. Unknown/non-editable fields are rejected, not
// silently dropped.
export async function updateRecord(
  registry: ResourceRegistry,
  resourceName: string,
  id: string,
  values: AdminRecord,
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

  const validated = validateValues(def, values ?? {}, { partial: true });
  if (!validated.ok) {
    return { ok: false as const, status: 400 as const, data: null, error: { code: "VALIDATION_FAILED", message: "Values are invalid.", issues: validated.errors } };
  }
  if (Object.keys(validated.values).length === 0) {
    return { ok: false as const, status: 400 as const, data: null, error: { code: "NO_EDITABLE_FIELDS", message: "No editable fields supplied." } };
  }

  const hooked = await beforeWrite(resourceName, "update", validated.values);
  if (!hooked) {
    return { ok: false as const, status: 409 as const, data: null, error: { code: "WRITE_BLOCKED", message: "Update was blocked by beforeWrite." } };
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

  return { ok: true as const, status: 200 as const, data: { id } };
}
